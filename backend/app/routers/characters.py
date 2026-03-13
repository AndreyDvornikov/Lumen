import enum

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user, get_current_gm, get_db
from app.models import Character, User

router = APIRouter(tags=["characters"])


class CharacterStatus(str, enum.Enum):
    ALIVE = "alive"
    DEAD = "dead"
    UNKNOWN = "unknown"


class CharacterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    race: str | None = Field(default=None, max_length=120)
    character_class: str | None = Field(default=None, max_length=120)
    avatar_url: str | None = Field(default=None, max_length=500)
    backstory: str | None = None
    status: CharacterStatus = CharacterStatus.UNKNOWN


class CharacterUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    race: str | None = Field(default=None, max_length=120)
    character_class: str | None = Field(default=None, max_length=120)
    avatar_url: str | None = Field(default=None, max_length=500)
    backstory: str | None = None
    status: CharacterStatus | None = None


class CharacterStatusUpdate(BaseModel):
    status: CharacterStatus


class CharacterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    race: str | None
    character_class: str | None
    avatar_url: str | None
    backstory: str | None
    status: CharacterStatus


def _to_response(character: Character) -> CharacterResponse:
    try:
        status = CharacterStatus(character.status)
    except ValueError:
        status = CharacterStatus.UNKNOWN

    return CharacterResponse(
        id=character.id,
        name=character.name,
        race=character.ancestry,
        character_class=character.archetype,
        avatar_url=character.portrait_url,
        backstory=character.backstory,
        status=status,
    )


@router.post("/gm/characters", response_model=CharacterResponse, status_code=status.HTTP_201_CREATED)
def create_character(
    payload: CharacterCreate,
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> CharacterResponse:
    character = Character(
        name=payload.name,
        ancestry=payload.race,
        archetype=payload.character_class,
        portrait_url=payload.avatar_url,
        backstory=payload.backstory,
        status=payload.status.value,
    )
    db.add(character)
    db.commit()
    db.refresh(character)
    return _to_response(character)


@router.patch("/gm/characters/{id}", response_model=CharacterResponse)
def update_character(
    id: int,
    payload: CharacterUpdate,
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> CharacterResponse:
    character = db.query(Character).filter(Character.id == id).first()
    if character is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")

    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates:
        character.name = updates["name"]
    if "race" in updates:
        character.ancestry = updates["race"]
    if "character_class" in updates:
        character.archetype = updates["character_class"]
    if "avatar_url" in updates:
        character.portrait_url = updates["avatar_url"]
    if "backstory" in updates:
        character.backstory = updates["backstory"]
    if "status" in updates and updates["status"] is not None:
        character.status = updates["status"].value

    db.commit()
    db.refresh(character)
    return _to_response(character)


@router.patch("/gm/characters/{id}/status", response_model=CharacterResponse)
def update_character_status(
    id: int,
    payload: CharacterStatusUpdate,
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> CharacterResponse:
    character = db.query(Character).filter(Character.id == id).first()
    if character is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")

    character.status = payload.status.value
    db.commit()
    db.refresh(character)
    return _to_response(character)


@router.get("/characters", response_model=list[CharacterResponse])
def list_characters(
    _current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[CharacterResponse]:
    characters = db.query(Character).order_by(Character.id.asc()).all()
    return [_to_response(character) for character in characters]
