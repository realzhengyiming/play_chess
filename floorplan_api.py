"""户型识别最小代理：运行后访问 http://127.0.0.1:8765/。"""

from __future__ import annotations

import asyncio
import json
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
SAMPLE_DIR = ROOT / "samples"
REMOTE_UPLOAD = "http://82.157.195.92:6699/upload_floorplan_image"
REMOTE_RECOGNIZE = "http://82.157.195.92:6699/gen_floor_plan_fast"

app = FastAPI(title="空间棋户型识别代理", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)
app.mount("/samples", StaticFiles(directory=SAMPLE_DIR), name="samples")


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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/upload")
async def upload(request: Request) -> Response:
    return await _proxy(request, REMOTE_UPLOAD)


@app.post("/api/recognize")
async def recognize(request: Request) -> Response:
    return await _proxy(request, REMOTE_RECOGNIZE)


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8765)
