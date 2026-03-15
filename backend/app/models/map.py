from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Map(Base):
    __tablename__ = "maps"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False, default=4096)
    height: Mapped[int] = mapped_column(Integer, nullable=False, default=4096)
    is_visible_to_players: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    created_by = relationship("User", back_populates="created_maps")
    layers = relationship("MapLayer", back_populates="map", cascade="all, delete-orphan", order_by="MapLayer.order_index")


class MapLayer(Base):
    __tablename__ = "map_layers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    map_id: Mapped[int] = mapped_column(ForeignKey("maps.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_visible_to_players: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    map = relationship("Map", back_populates="layers")
    elements = relationship("MapElement", back_populates="layer", cascade="all, delete-orphan")


class MapElement(Base):
    __tablename__ = "map_elements"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    layer_id: Mapped[int] = mapped_column(ForeignKey("map_layers.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    x: Mapped[float] = mapped_column(nullable=False)
    y: Mapped[float] = mapped_column(nullable=False)
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    is_visible_to_players: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    layer = relationship("MapLayer", back_populates="elements")
