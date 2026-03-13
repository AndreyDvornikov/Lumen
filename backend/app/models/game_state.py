from sqlalchemy import Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GameState(Base):
    __tablename__ = "game_state"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    darkness_level: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
