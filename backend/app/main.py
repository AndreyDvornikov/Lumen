import asyncio
from pathlib import Path

from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.auth.dependencies import get_current_active_user
from app.auth.router import router as auth_router
from app.auth.security import decode_access_token
from app.cache import redis_client
from app.config import get_settings
from app.database import init_db
from app.realtime import campaign_socket_manager
from app.routers.gm import router as gm_router
from app.routers.maps import router as maps_router
from app.routers.timers import router as timers_router
from app.routers.uploads import router as uploads_router
from app.routers.wiki import router as wiki_router

app = FastAPI(title="Lumen Protocol API", version="0.1.0")
settings = get_settings()
static_dir = Path(__file__).resolve().parents[1] / "static"

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://lumen-protocol.oxytocin.moe",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(gm_router)
app.include_router(maps_router)
app.include_router(timers_router)
app.include_router(uploads_router)
app.include_router(wiki_router)


@app.on_event("startup")
def startup_event() -> None:
    init_db()
    (static_dir / "uploads").mkdir(parents=True, exist_ok=True)
    campaign_socket_manager.set_loop(asyncio.get_event_loop())


# 🔐 Защищённая отдача изображений (FIXED)
@app.get("/protected-image/{filename:path}")
def get_protected_image(
    filename: str,
    token: str = Query(...),
):
    # 🔐 проверка токена
    try:
        decode_access_token(token, settings.jwt_secret_key)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    uploads_dir = (static_dir / "uploads").resolve()
    file_path = (uploads_dir / filename).resolve()

    # защита от ../../
    if not str(file_path).startswith(str(uploads_dir)):
        raise HTTPException(status_code=400, detail="Invalid path")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(file_path)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "lumen-protocol-backend"}


@app.get("/api/v1/system")
def system_status(_=Depends(get_current_active_user)) -> dict[str, str | int]:
    return {
        "postgres_host": settings.postgres_host,
        "postgres_db": settings.postgres_db,
        "redis_host": settings.redis_host,
        "redis_port": settings.redis_port,
    }


@app.websocket("/ws/campaign/{campaign_id}")
async def campaign_socket(
    websocket: WebSocket,
    campaign_id: str,
    token: str = Query(...),
) -> None:
    # 🔐 проверка токена
    try:
        decode_access_token(token, settings.jwt_secret_key)
    except Exception:
        await websocket.close(code=1008)
        return

    await campaign_socket_manager.connect(campaign_id, websocket)

    join_message = f"Joined campaign {campaign_id}"
    redis_client.publish(f"campaign:{campaign_id}", join_message)
    await websocket.send_json({"event": "system", "message": join_message})

    try:
        while True:
            message = await websocket.receive_text()
            redis_client.publish(f"campaign:{campaign_id}", message)
    except WebSocketDisconnect:
        leave_message = f"Left campaign {campaign_id}"
        redis_client.publish(f"campaign:{campaign_id}", leave_message)
        campaign_socket_manager.disconnect(campaign_id, websocket)
