"""批量固化户型识别样例：上传图片、请求推理并保存本地 JSON。"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import time
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "样例图片数据"
DEFAULT_OUTPUT = ROOT / "samples"
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def area_from_name(path: Path) -> float:
    match = re.search(r"_([0-9]+(?:\.[0-9]+)?)$", path.stem)
    if not match:
        raise ValueError(f"文件名末尾没有面积：{path.name}")
    return float(match.group(1))


def request_json(session: requests.Session, method: str, url: str, **kwargs) -> dict:
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            response = session.request(method, url, timeout=150, **kwargs)
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError("接口没有返回 JSON object")
            if int(payload.get("status", 200)) >= 400:
                raise RuntimeError(payload.get("msg") or payload.get("message") or "接口返回失败")
            return payload
        except (requests.RequestException, ValueError, RuntimeError) as error:
            last_error = error
            if attempt < 2:
                time.sleep(0.8 * (attempt + 1))
    raise RuntimeError(str(last_error)) from last_error


def atomic_json(path: Path, payload: dict) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--base-url", default="http://127.0.0.1:8765")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    images = sorted(path for path in args.input.iterdir() if path.suffix.lower() in IMAGE_SUFFIXES)
    args.output.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    completed = 0
    for index, source in enumerate(images, 1):
        area = area_from_name(source)
        target_image = args.output / source.name
        target_json = args.output / f"{source.stem}.json"
        if target_json.exists() and not args.force:
            if not target_image.exists():
                shutil.copy2(source, target_image)
            print(f"[{index}/{len(images)}] 跳过已有结果：{source.name}", flush=True)
            completed += 1
            continue

        print(f"[{index}/{len(images)}] 上传 {source.name}（{area:g}㎡）", flush=True)
        upload: dict | None = None
        upload_error: Exception | None = None
        for attempt in range(3):
            try:
                # 每次重试都重新打开文件，不能复用已经读到 EOF 的 multipart 流。
                with source.open("rb") as handle:
                    response = session.post(
                        f"{args.base_url}/api/upload",
                        files={"image_obj_bytes": (source.name, handle, f"image/{source.suffix.lower().lstrip('.')}")},
                        timeout=150,
                    )
                response.raise_for_status()
                upload = response.json()
                if int(upload.get("status", 200)) >= 400:
                    raise RuntimeError(upload.get("msg") or upload.get("message") or "上传失败")
                break
            except (requests.RequestException, ValueError, RuntimeError) as error:
                upload_error = error
                upload = None
                if attempt < 2:
                    time.sleep(0.8 * (attempt + 1))
        if upload is None:
            raise RuntimeError(f"{source.name}：{upload_error}") from upload_error
        image_id = upload.get("data", {}).get("image_id") or upload.get("image_id")
        if not image_id:
            raise RuntimeError(f"{source.name}：上传响应缺少 image_id")

        recognized = request_json(
            session,
            "POST",
            f"{args.base_url}/api/recognize",
            json={"image_id": image_id, "input_area": area, "use_conver": False},
        )
        room_data = recognized.get("data", {}).get("room_data")
        if not isinstance(room_data, list) or not room_data:
            raise RuntimeError(f"{source.name}：识别结果没有房间数据")
        shutil.copy2(source, target_image)
        atomic_json(target_json, recognized)
        print(f"    保存 {target_json.name} · {len(room_data)} 个房间", flush=True)
        completed += 1

    print(f"完成：{completed}/{len(images)} 个样例", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
