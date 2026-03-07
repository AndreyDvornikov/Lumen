from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Character(Base):
    __tablename__ = "characters"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    archetype: Mapped[str | None] = mapped_column(String(120))
    ancestry: Mapped[str | None] = mapped_column(String(120))
    level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    hit_points_current: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    hit_points_max: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
    stats: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    inventory: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    backstory: Mapped[str | None] = mapped_column(Text)
    portrait_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    player = relationship("Player", back_populates="characters")
