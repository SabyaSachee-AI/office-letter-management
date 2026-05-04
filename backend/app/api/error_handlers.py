"""Central HTTP error responses and exception handlers."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

logger = logging.getLogger("app.errors")


def _status_to_code(http_status: int) -> str:
    return {
        status.HTTP_400_BAD_REQUEST: "bad_request",
        status.HTTP_401_UNAUTHORIZED: "unauthorized",
        status.HTTP_403_FORBIDDEN: "forbidden",
        status.HTTP_404_NOT_FOUND: "not_found",
        status.HTTP_405_METHOD_NOT_ALLOWED: "method_not_allowed",
        status.HTTP_409_CONFLICT: "conflict",
        status.HTTP_422_UNPROCESSABLE_CONTENT: "validation_error",
        status.HTTP_503_SERVICE_UNAVAILABLE: "service_unavailable",
    }.get(http_status, "http_error")


def _detail_and_message(detail: Any) -> tuple[Any, str]:
    """Split FastAPI/Starlette detail into JSON-safe payload and a single user-facing line."""
    if detail is None:
        return None, "Request failed"
    if isinstance(detail, str):
        return detail, detail
    if isinstance(detail, list):
        parts: list[str] = []
        for item in detail:
            if isinstance(item, dict) and "msg" in item:
                loc = item.get("loc") or ()
                loc_str = ".".join(str(x) for x in loc if x not in ("body", "query", "path"))
                prefix = f"{loc_str}: " if loc_str else ""
                parts.append(f"{prefix}{item['msg']}")
            else:
                parts.append(str(item))
        msg = "; ".join(parts) if parts else "Invalid request"
        return jsonable_encoder(detail), msg
    if isinstance(detail, dict):
        encoded = jsonable_encoder(detail)
        msg = str(detail.get("message") or detail.get("msg") or encoded)
        return encoded, msg
    return jsonable_encoder(detail), str(detail)


def build_validation_body(errors: list) -> dict[str, Any]:
    """Readable summary + field breakdown from RequestValidationError."""
    field_errors: list[dict[str, str]] = []
    parts: list[str] = []
    for err in errors:
        loc = err.get("loc") or ()
        loc_parts = [str(x) for x in loc if x not in ("body", "query", "path")]
        field = ".".join(loc_parts) if loc_parts else "request"
        msg = err.get("msg") or "Invalid value"
        parts.append(f"{field}: {msg}")
        field_errors.append({"field": field, "message": msg})
    message = "Validation failed. " + "; ".join(parts) if parts else "Validation failed."
    return {
        "detail": jsonable_encoder(errors),
        "message": message,
        "code": "validation_error",
        "field_errors": field_errors,
    }


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    detail_json, message = _detail_and_message(exc.detail)
    body = {
        "detail": detail_json,
        "message": message,
        "code": _status_to_code(exc.status_code),
    }
    if exc.status_code >= 500:
        logger.error(
            "HTTP %s %s -> %s | %s",
            request.method,
            request.url.path,
            exc.status_code,
            message,
        )
    else:
        logger.debug(
            "HTTP %s %s -> %s | %s",
            request.method,
            request.url.path,
            exc.status_code,
            message,
        )
    return JSONResponse(status_code=exc.status_code, content=body)


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = exc.errors()
    body = build_validation_body(errors)
    logger.debug(
        "Validation error %s %s: %s",
        request.method,
        request.url.path,
        body["message"],
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content=body,
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(
        "Unhandled error %s %s",
        request.method,
        request.url.path,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An unexpected error occurred",
            "message": "An unexpected error occurred. Please try again later.",
            "code": "internal_error",
        },
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
