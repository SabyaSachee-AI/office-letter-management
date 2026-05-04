import io

from fastapi import UploadFile

from app.core.upload_utils import save_upload_streaming


def test_save_upload_streaming_under_limit(tmp_path):
    data = b"hello"
    uf = UploadFile(filename="x.txt", file=io.BytesIO(data))
    out = tmp_path / "out.bin"
    n = save_upload_streaming(uf, out, max_bytes=100)
    assert n == len(data)
    assert out.read_bytes() == data


def test_save_upload_streaming_rejects_over_limit(tmp_path):
    data = b"x" * 100
    uf = UploadFile(filename="x.bin", file=io.BytesIO(data))
    out = tmp_path / "big.bin"
    try:
        save_upload_streaming(uf, out, max_bytes=50)
    except ValueError as e:
        assert "maximum" in str(e).lower()
    else:
        raise AssertionError("expected ValueError")
    assert not out.exists()
