import hmac
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from reliability_lab.action_routes import router as action_router
from reliability_lab.actions import ActionError
from reliability_lab.agent import Agent
from reliability_lab.config import ConfigStatus, public_config
from reliability_lab.domain import AgentAnswer, QueryRequest, Record
from reliability_lab.notion import NOTION_VERSION, SourceError, get_notion_source
from reliability_lab.providers import ProviderError, get_provider
from reliability_lab.routes import router
from reliability_lab.schemas import ErrorResponse, HealthResponse
from reliability_lab.storage import get_store
from reliability_lab.workspace import SyntheticWorkspace

logger = logging.getLogger("reliability_lab")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    get_store().recover()
    yield


app = FastAPI(title="Agent Reliability Lab", version="0.1.0", docs_url="/docs", lifespan=lifespan)
app.include_router(router)
app.include_router(action_router)


@app.exception_handler(ActionError)
async def action_error(_request: Request, exc: ActionError):
    return error_response(exc.status, "action_error", str(exc))


@app.middleware("http")
async def safe_unexpected_errors(request: Request, call_next):
    try:
        if request.method != "OPTIONS" and request.url.path not in {
            "/health",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/docs/oauth2-redirect",
        }:
            expected = os.environ.get("LAB_SESSION_TOKEN", "")
            supplied = request.headers.get("X-Lab-Token", "")
            if not expected or not hmac.compare_digest(expected, supplied):
                return error_response(
                    401,
                    "session_required",
                    "Local session authorization failed. Restart using the supervised launcher.",
                )
        return await call_next(request)
    except Exception:
        logger.error('{"event":"request_failed","code":"internal_error"}')
        return error_response(500, "internal_error", "An unexpected local service error occurred.")


@app.exception_handler(ProviderError)
async def provider_error(_request: Request, exc: ProviderError):
    logger.warning('{"event":"provider_failed","code":"%s"}', exc.code)
    status = (
        503
        if exc.code == "not_configured"
        else 504
        if exc.code == "timeout"
        else 429
        if exc.code in {"quota_exhausted", "rate_limited"}
        else 502
    )
    return error_response(status, exc.code, str(exc))


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:1420",
        "http://127.0.0.1:1420",
        "tauri://localhost",
        "http://tauri.localhost",
        "https://tauri.localhost",
    ],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Accept", "Content-Type", "X-Lab-Token"],
)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["127.0.0.1", "localhost", "testserver"],
)


def error_response(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content=ErrorResponse(code=code, message=message).model_dump(),
    )


@app.exception_handler(HTTPException)
async def http_error(_request: Request, exc: HTTPException) -> JSONResponse:
    message = (
        exc.detail if isinstance(exc.detail, str) else "The requested operation is unavailable."
    )
    return error_response(exc.status_code, "http_error", message)


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, _exc: RequestValidationError) -> JSONResponse:
    return error_response(422, "validation_error", "The request is invalid.")


@app.exception_handler(Exception)
async def unexpected_error(_request: Request, _exc: Exception) -> JSONResponse:
    # Deliberately omit exception text, request payloads, and headers.
    logger.error('{"event":"request_failed","code":"internal_error"}')
    return error_response(500, "internal_error", "An unexpected local service error occurred.")


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse()


@app.get("/session", response_model=HealthResponse)
async def session_probe() -> HealthResponse:
    """Protected readiness probe used by the native host to verify its own child."""
    return HealthResponse()


@app.post("/agent/query", response_model=AgentAnswer)
async def query_agent(request: QueryRequest) -> AgentAnswer:
    if request.provider != "mock" and not request.allow_external_transmission:
        from fastapi import HTTPException

        raise HTTPException(400, "Explicit external transmission consent is required.")
    source = get_notion_source() if request.source == "notion" else SyntheticWorkspace()
    return await Agent(source, get_provider(request.provider, request.model)).query(request)


@app.get("/config", response_model=ConfigStatus)
async def configuration():
    return public_config()


@app.exception_handler(SourceError)
async def source_error(_request: Request, exc: SourceError):
    status = (
        403
        if exc.code in {"permission_denied", "scope_violation"}
        else 429
        if exc.code == "rate_limited"
        else 504
        if exc.code == "timeout"
        else 503
        if exc.code == "not_configured"
        else 502
    )
    return error_response(status, "notion_" + exc.code, str(exc))


@app.post("/notion/check")
async def check_notion():
    source = get_notion_source()
    records = await source.records()
    return {
        "connected": True,
        "root_count": len(source.roots),
        "record_count": len(records),
        "read_only": True,
        "api_version": NOTION_VERSION,
    }


@app.get("/notion/records", response_model=list[Record])
async def notion_records():
    return await get_notion_source().records()


@app.post("/notion/clear-cache")
async def clear_notion_cache():
    await get_notion_source().clear_cache()
    return {"cleared": True}
