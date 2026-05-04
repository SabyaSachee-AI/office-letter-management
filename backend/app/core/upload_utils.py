"""Streaming uploads with a maximum size cap."""

from pathlib import Path

from fastapi import UploadFile


def save_upload_streaming(upload: UploadFile, path: Path, *, max_bytes: int) -> int:
    """
    Write upload stream to path. Returns bytes written.
    Deletes partial file and raises ValueError if max_bytes is exceeded.
    """
    total = 0
    try:
        with path.open("wb") as out:
            while True:
                chunk = upload.file.read(1024 * 1024)
                if not chunk:
                    break
                if total + len(chunk) > max_bytes:
                    raise ValueError(
                        f"File exceeds maximum allowed size ({max_bytes // (1024 * 1024)} MiB)"
                    )
                total += len(chunk)
                out.write(chunk)
    except Exception:
        path.unlink(missing_ok=True)
        raise
    return total
