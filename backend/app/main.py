from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.cache import redis_client
from app.config import get_settings

app = FastAPI(title="Lumen Protocol API", version="0.1.0")
settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "lumen-protocol-backend"}


@app.get("/api/v1/system")
def system_status() -> dict[str, str | int]:
    return {
        "postgres_host": settings.postgres_host,
        "postgres_db": settings.postgres_db,
        "redis_host": settings.redis_host,
        "redis_port": settings.redis_port,
    }


@app.websocket("/ws/campaign/{campaign_id}")
async def campaign_socket(websocket: WebSocket, campaign_id: str) -> None:
    await websocket.accept()

    join_message = f"Joined campaign {campaign_id}"
    redis_client.publish(f"campaign:{campaign_id}", join_message)
    await websocket.send_json({"event": "system", "message": join_message})

    try:
        while True:
            message = await websocket.receive_text()
            redis_client.publish(f"campaign:{campaign_id}", message)
            await websocket.send_json(
                {
                    "event": "chat",
                    "campaignId": campaign_id,
                    "message": message,
                }
            )
    except WebSocketDisconnect:
        leave_message = f"Left campaign {campaign_id}"
        redis_client.publish(f"campaign:{campaign_id}", leave_message)
