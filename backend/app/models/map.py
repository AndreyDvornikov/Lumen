from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Map(Base):
    __tablename__ = "maps"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))
    width: Mapped[int] = mapped_column(Integer, default=4096, nullable=False)
    height: Mapped[int] = mapped_column(Integer, default=4096, nullable=False)
    grid_size: Mapped[int] = mapped_column(Integer, default=70, nullable=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    created_by = relationship("User", back_populates="created_maps")
    markers = relationship("MapMarker", back_populates="map", cascade="all, delete-orphan")


class MapMarker(Base):
    __tablename__ = "map_markers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    map_id: Mapped[int] = mapped_column(ForeignKey("maps.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    x_coordinate: Mapped[float] = mapped_column(nullable=False)
    y_coordinate: Mapped[float] = mapped_column(nullable=False)
    icon: Mapped[str | None] = mapped_column(String(64))
    color: Mapped[str | None] = mapped_column(String(20))
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    marker_data: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    map = relationship("Map", back_populates="markers")
    created_by = relationship("User", back_populates="created_map_markers")
