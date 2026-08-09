"""户型识别最小代理：运行后访问 http://127.0.0.1:8765/。"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import threading
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles


ROOT = Path(__file__).resolve().parent
HTML_FILE = ROOT / "bedroom-space-chess-V3.html"
EDITOR_FILE = ROOT / "furniture-rule-editor.html"
MODULE_GROWTH_FILE = ROOT / "module-growth-prototype.html"
SAMPLE_DIR = ROOT / "samples"
ASSET_DIR = ROOT / "assets"
CONFIG_DIR = ROOT / "server_config"
DEFAULT_CONFIG_FILE = CONFIG_DIR / "furniture-config-default.json"
CURRENT_CONFIG_FILE = CONFIG_DIR / "furniture-config-current.json"
CONFIG_VALIDATOR_FILE = ROOT / "scripts" / "validate_global_config.js"
REMOTE_UPLOAD = "http://82.157.195.92:6699/upload_floorplan_image"
REMOTE_RECOGNIZE = "http://82.157.195.92:6699/gen_floor_plan_fast"

app = FastAPI(title="空间棋户型识别代理", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["*"],
)
app.mount("/samples", StaticFiles(directory=SAMPLE_DIR), name="samples")
app.mount("/assets", StaticFiles(directory=ASSET_DIR), name="assets")
_config_lock = threading.Lock()


def _read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError("配置根节点必须是 JSON object")
    return value


def _write_json_atomic(path: Path, value: dict) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.flush()
        os.fsync(handle.fileno())
    temporary.replace(path)


def _config_response(value: dict, source: str) -> dict:
    return {"ok": True, "source": source, "config": value}


def _validate_global_config(value: dict) -> None:
    """使用浏览器和测试共用的唯一配置契约，不在 Python 复制布局规则。"""
    try:
        completed = subprocess.run(
            ["node", str(CONFIG_VALIDATOR_FILE)],
            input=json.dumps(value, ensure_ascii=False),
            capture_output=True,
            check=False,
            text=True,
            timeout=10,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired) as error:
        raise RuntimeError(f"无法执行全局配置契约：{error}") from error
    if completed.returncode != 0:
        detail = completed.stderr.strip() or completed.stdout.strip() or "未知配置错误"
        raise ValueError(detail)


def _forward(url: str, body: bytes, content_type: str) -> tuple[int, bytes, str]:
    request = UrlRequest(
        url,
        data=body,
        headers={"Content-Type": content_type, "Accept": "application/json"},
        method="POST",
    )
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urlopen(request, timeout=120) as remote:
                payload = remote.read()
                # 两个上游接口都应返回 JSON；空包或截断包属于瞬时失败，直接重试。
                if not payload.strip():
                    raise ConnectionError("远端返回空响应")
                json.loads(payload)
                return remote.status, payload, remote.headers.get("Content-Type", "application/json")
        except HTTPError as error:
            return error.code, error.read(), error.headers.get("Content-Type", "application/json")
        except (URLError, ConnectionResetError, TimeoutError, OSError, ValueError) as error:
            last_error = error
            if attempt < 2:
                time.sleep(0.4 * (attempt + 1))
    assert last_error is not None
    raise last_error


async def _proxy(request: Request, url: str) -> Response:
    body = await request.body()
    content_type = request.headers.get("content-type", "application/octet-stream")
    try:
        status, payload, response_type = await asyncio.to_thread(_forward, url, body, content_type)
        return Response(payload, status_code=status, headers={"Content-Type": response_type})
    except URLError as error:
        return JSONResponse({"detail": f"无法连接户型识别接口：{error.reason}"}, status_code=502)
    except Exception as error:
        return JSONResponse({"detail": f"代理请求失败：{error}"}, status_code=502)


@app.get("/")
def index() -> FileResponse:
    return FileResponse(HTML_FILE, media_type="text/html; charset=utf-8")


@app.get("/bedroom-space-chess-V3.html")
def main_page() -> FileResponse:
    return FileResponse(HTML_FILE, media_type="text/html; charset=utf-8")


@app.get("/furniture-rule-editor.html")
def furniture_rule_editor() -> FileResponse:
    return FileResponse(EDITOR_FILE, media_type="text/html; charset=utf-8")


@app.get("/module-growth-prototype.html")
def module_growth_prototype() -> FileResponse:
    """独立的模块生长实验页；不读取或修改主页面配置。"""
    return FileResponse(MODULE_GROWTH_FILE, media_type="text/html; charset=utf-8")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/furniture-config/bootstrap")
async def bootstrap_furniture_config(request: Request) -> JSONResponse:
    """由配置页安装代码内置基线。

    同一 baselineVersion 不会覆盖任何网页修改；只有代码基线版本升级时才更新
    default。本地原型可显式携带 activate_default_on_upgrade，让新基线同时成为当前全局配置。
    """
    body = await request.json()
    default_config = body.get("default_config") if isinstance(body, dict) else None
    if not isinstance(default_config, dict):
        return JSONResponse({"detail": "缺少 default_config"}, status_code=422)
    try:
        _validate_global_config(default_config)
    except (ValueError, RuntimeError) as error:
        return JSONResponse({"detail": f"全局配置契约失败：{error}"}, status_code=422)
    with _config_lock:
        stored_default = _read_json(DEFAULT_CONFIG_FILE) if DEFAULT_CONFIG_FILE.exists() else None
        incoming_version = int(default_config.get("baselineVersion") or 0)
        stored_version = int((stored_default or {}).get("baselineVersion") or 0)
        upgraded = stored_default is None or incoming_version > stored_version
        if upgraded:
            _write_json_atomic(DEFAULT_CONFIG_FILE, default_config)
        if not CURRENT_CONFIG_FILE.exists() or (
            upgraded and bool(body.get("activate_default_on_upgrade"))
        ):
            _write_json_atomic(CURRENT_CONFIG_FILE, _read_json(DEFAULT_CONFIG_FILE))
        current = _read_json(CURRENT_CONFIG_FILE)
    response = _config_response(current, "current")
    response["baseline_upgraded"] = upgraded
    response["baseline_version"] = incoming_version if upgraded else stored_version
    return JSONResponse(response)


@app.get("/api/furniture-config")
def get_furniture_config() -> JSONResponse:
    with _config_lock:
        if not CURRENT_CONFIG_FILE.exists():
            return JSONResponse({"detail": "全局配置尚未初始化"}, status_code=404)
        current = _read_json(CURRENT_CONFIG_FILE)
    try:
        _validate_global_config(current)
    except (ValueError, RuntimeError) as error:
        return JSONResponse({"detail": f"当前全局配置无效：{error}"}, status_code=500)
    return JSONResponse(_config_response(current, "current"))


@app.get("/api/furniture-config/default")
def get_default_furniture_config() -> JSONResponse:
    with _config_lock:
        if not DEFAULT_CONFIG_FILE.exists():
            return JSONResponse({"detail": "默认配置尚未初始化"}, status_code=404)
        default = _read_json(DEFAULT_CONFIG_FILE)
    try:
        _validate_global_config(default)
    except (ValueError, RuntimeError) as error:
        return JSONResponse({"detail": f"默认配置无效：{error}"}, status_code=500)
    return JSONResponse(_config_response(default, "default"))


@app.put("/api/furniture-config")
async def put_furniture_config(request: Request) -> JSONResponse:
    """覆盖唯一的全局当前配置；不创建版本历史。"""
    value = await request.json()
    if not isinstance(value, dict):
        return JSONResponse({"detail": "配置必须是 JSON object"}, status_code=422)
    try:
        _validate_global_config(value)
    except (ValueError, RuntimeError) as error:
        return JSONResponse({"detail": f"全局配置契约失败：{error}"}, status_code=422)
    with _config_lock:
        _write_json_atomic(CURRENT_CONFIG_FILE, value)
    return JSONResponse(_config_response(value, "current"))


@app.post("/api/furniture-config/restore")
def restore_furniture_config() -> JSONResponse:
    with _config_lock:
        if not DEFAULT_CONFIG_FILE.exists():
            return JSONResponse({"detail": "默认配置尚未初始化"}, status_code=404)
        default = _read_json(DEFAULT_CONFIG_FILE)
        try:
            _validate_global_config(default)
        except (ValueError, RuntimeError) as error:
            return JSONResponse({"detail": f"默认配置无效：{error}"}, status_code=500)
        _write_json_atomic(CURRENT_CONFIG_FILE, default)
    return JSONResponse(_config_response(default, "default"))


@app.post("/api/upload")
async def upload(request: Request) -> Response:
    return await _proxy(request, REMOTE_UPLOAD)


@app.post("/api/recognize")
async def recognize(request: Request) -> Response:
    return await _proxy(request, REMOTE_RECOGNIZE)


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8765)
