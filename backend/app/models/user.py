from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    players = relationship("Player", back_populates="user", cascade="all, delete-orphan")
    created_wiki_categories = relationship(
        "WikiCategory", back_populates="created_by", foreign_keys="WikiCategory.created_by_id"
    )
    created_wiki_entries = relationship(
        "WikiEntry", back_populates="created_by", foreign_keys="WikiEntry.created_by_id"
    )
    updated_wiki_entries = relationship(
        "WikiEntry", back_populates="updated_by", foreign_keys="WikiEntry.updated_by_id"
    )
    created_maps = relationship("Map", back_populates="created_by")
    created_map_markers = relationship("MapMarker", back_populates="created_by")
    created_timers = relationship("Timer", back_populates="created_by")
