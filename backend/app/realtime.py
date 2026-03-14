from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class CampaignSocketManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    async def connect(self, campaign_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[campaign_id].add(websocket)

    def disconnect(self, campaign_id: str, websocket: WebSocket) -> None:
        campaign_connections = self._connections.get(campaign_id)
        if campaign_connections is None:
            return

        campaign_connections.discard(websocket)
        if not campaign_connections:
            self._connections.pop(campaign_id, None)

    async def broadcast(self, campaign_id: str, payload: dict[str, Any]) -> None:
        sockets = list(self._connections.get(campaign_id, set()))
        stale: list[WebSocket] = []
        for socket in sockets:
            try:
                await socket.send_json(payload)
            except Exception:
                stale.append(socket)

        for socket in stale:
            self.disconnect(campaign_id, socket)

    def broadcast_from_thread(self, campaign_id: str, payload: dict[str, Any]) -> None:
        if self._loop is None or self._loop.is_closed():
            return

        asyncio.run_coroutine_threadsafe(self.broadcast(campaign_id, payload), self._loop)


campaign_socket_manager = CampaignSocketManager()
