import re
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.auth.dependencies import get_current_gm, get_db
from app.models import Map, MapElement, MapLayer, User, WikiCategory, WikiEntry, WikiVisibilityState
from app.models.user import UserRole
from app.realtime import campaign_socket_manager

router = APIRouter(prefix="/gm", tags=["gm"])


class WikiCategoryCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    slug: str = Field(min_length=1, max_length=180)
    image_url: str | None = Field(default=None, max_length=500)
    description: str | None = None
    parent_id: int | None = None


class WikiCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    image_url: str | None
    description: str | None
    parent_id: int | None
    created_by_id: int
    created_at: datetime


class GMUserCreateRequest(BaseModel):
    email: str
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=128)


class GMUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    username: str
    role: str
    created_at: datetime


class GMMapCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    image_url: str = Field(min_length=1, max_length=500)
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    is_visible_to_players: bool = False


class GMMapResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    image_url: str
    width: int
    height: int
    is_visible_to_players: bool
    created_by_id: int
    created_at: datetime


class GMMapLayerCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    order_index: int = Field(ge=0)
    is_visible_to_players: bool = False


class GMMapLayerUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    order_index: int | None = Field(default=None, ge=0)
    is_visible_to_players: bool | None = None


class GMMapLayerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    map_id: int
    name: str
    order_index: int
    is_visible_to_players: bool


class GMMapElementCreateRequest(BaseModel):
    type: str = Field(min_length=1, max_length=32)
    x: float
    y: float
    data: dict[str, Any] = Field(default_factory=dict)
    is_visible_to_players: bool = False


class GMMapElementUpdateRequest(BaseModel):
    x: float | None = None
    y: float | None = None
    data: dict[str, Any] | None = None
    is_visible_to_players: bool | None = None


class GMMapElementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    layer_id: int
    type: str
    x: float
    y: float
    data: dict[str, Any]
    is_visible_to_players: bool


class WikiEntryCreateRequest(BaseModel):
    category_id: int
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=240)
    image_url: str | None = Field(default=None, max_length=500)
    content: str = ""
    is_published: bool = False
    is_unlocked: bool = False
    visibility_state: WikiVisibilityState = WikiVisibilityState.HIDDEN
    tags: list[str] = Field(default_factory=list)


class WikiCategoryUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    slug: str | None = Field(default=None, min_length=1, max_length=180)
    image_url: str | None = Field(default=None, max_length=500)
    description: str | None = None
    parent_id: int | None = None


class WikiEntryUpdateRequest(BaseModel):
    category_id: int | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    slug: str | None = Field(default=None, min_length=1, max_length=240)
    image_url: str | None = Field(default=None, max_length=500)
    content: str | None = Field(default=None, min_length=1)
    is_published: bool | None = None
    is_unlocked: bool | None = None
    visibility_state: WikiVisibilityState | None = None
    tags: list[str] | None = None


class WikiEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    title: str
    slug: str
    image_url: str | None
    content: str
    is_published: bool
    is_unlocked: bool
    visibility_state: WikiVisibilityState
    tags: list[str]
    linked_entry_ids: list[int]
    created_by_id: int
    updated_by_id: int | None
    created_at: datetime
    updated_at: datetime


def _extract_linked_entry_ids(db: Session, content: str) -> list[int]:
    linked_ids: list[int] = []
    seen: set[int] = set()
    for title in re.findall(r"\[\[([^\]]+)\]\]", content):
        normalized = title.strip().lower()
        if not normalized:
            continue
        entry = db.query(WikiEntry).filter(WikiEntry.title.ilike(title.strip())).first()
        if entry and entry.id not in seen:
            seen.add(entry.id)
            linked_ids.append(entry.id)
    return linked_ids


def _emit_wiki_event(event: str, entry: WikiEntry) -> None:
    campaign_socket_manager.broadcast_from_thread(
        "wiki",
        {
            "event": event,
            "entryId": entry.id,
            "categoryId": entry.category_id,
            "visibilityState": str(entry.visibility_state),
            "title": entry.title,
        },
    )


@router.get("/test")
def gm_test(_current_user: User = Depends(get_current_gm)) -> dict[str, str]:
    return {"message": "GM access granted"}


@router.get("/users", response_model=list[GMUserResponse])
def list_gm_users(
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> list[GMUserResponse]:
    users = db.query(User).filter(User.role == UserRole.PLAYER.value).order_by(User.created_at.desc()).all()
    return [GMUserResponse.model_validate(user) for user in users]


@router.post("/users", response_model=GMUserResponse, status_code=status.HTTP_201_CREATED)
def create_gm_user(
    payload: GMUserCreateRequest,
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> GMUserResponse:
    user = User(
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=UserRole.PLAYER.value,
        is_active=True,
        is_admin=False,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        message = str(exc.orig).lower() if exc.orig is not None else ""
        if "email" in message:
            detail = "User with this email already exists"
        elif "username" in message:
            detail = "User with this username already exists"
        else:
            detail = "User already exists"
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)
    db.refresh(user)
    return GMUserResponse.model_validate(user)


@router.get("/maps", response_model=list[GMMapResponse])
def list_gm_maps(
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> list[GMMapResponse]:
    maps = db.query(Map).order_by(Map.id.asc()).all()
    return [GMMapResponse.model_validate(campaign_map) for campaign_map in maps]


@router.get("/maps/{map_id}", response_model=GMMapResponse)
def get_gm_map(
    map_id: int,
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> GMMapResponse:
    campaign_map = db.query(Map).filter(Map.id == map_id).first()
    if campaign_map is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found")
    return GMMapResponse.model_validate(campaign_map)


@router.get("/maps/{map_id}/layers", response_model=list[GMMapLayerResponse])
def list_gm_map_layers(
    map_id: int,
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> list[GMMapLayerResponse]:
    layers = db.query(MapLayer).filter(MapLayer.map_id == map_id).order_by(MapLayer.order_index.asc(), MapLayer.id.asc()).all()
    return [GMMapLayerResponse.model_validate(layer) for layer in layers]


@router.get("/maps/layers/{layer_id}/elements", response_model=list[GMMapElementResponse])
def list_gm_map_elements(
    layer_id: int,
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> list[GMMapElementResponse]:
    elements = db.query(MapElement).filter(MapElement.layer_id == layer_id).order_by(MapElement.id.asc()).all()
    return [GMMapElementResponse.model_validate(element) for element in elements]


@router.post("/maps", response_model=GMMapResponse, status_code=status.HTTP_201_CREATED)
def create_gm_map(
    payload: GMMapCreateRequest,
    current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> GMMapResponse:
    campaign_map = Map(
        name=payload.name,
        image_url=payload.image_url,
        width=payload.width,
        height=payload.height,
        is_visible_to_players=payload.is_visible_to_players,
        created_by_id=current_user.id,
    )
    db.add(campaign_map)
    db.commit()
    db.refresh(campaign_map)
    return GMMapResponse.model_validate(campaign_map)


@router.post("/maps/{map_id}/layers", response_model=GMMapLayerResponse, status_code=status.HTTP_201_CREATED)
def create_gm_map_layer(
    map_id: int,
    payload: GMMapLayerCreateRequest,
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> GMMapLayerResponse:
    campaign_map = db.query(Map).filter(Map.id == map_id).first()
    if campaign_map is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found")

    layer = MapLayer(
        map_id=map_id,
        name=payload.name,
        order_index=payload.order_index,
        is_visible_to_players=payload.is_visible_to_players,
    )
    db.add(layer)
    db.commit()
    db.refresh(layer)
    return GMMapLayerResponse.model_validate(layer)


@router.patch("/maps/layers/{layer_id}", response_model=GMMapLayerResponse)
def update_gm_map_layer(
    layer_id: int,
    payload: GMMapLayerUpdateRequest,
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> GMMapLayerResponse:
    layer = db.query(MapLayer).filter(MapLayer.id == layer_id).first()
    if layer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Layer not found")

    updates = payload.model_dump(exclude_unset=True)
    for field in ("name", "order_index", "is_visible_to_players"):
        if field in updates:
            setattr(layer, field, updates[field])

    db.commit()
    db.refresh(layer)
    return GMMapLayerResponse.model_validate(layer)


@router.delete("/maps/layers/{layer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_gm_map_layer(
    layer_id: int,
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> None:
    layer = db.query(MapLayer).filter(MapLayer.id == layer_id).first()
    if layer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Layer not found")

    db.delete(layer)
    db.commit()


@router.post("/maps/layers/{layer_id}/elements", response_model=GMMapElementResponse, status_code=status.HTTP_201_CREATED)
def create_gm_map_element(
    layer_id: int,
    payload: GMMapElementCreateRequest,
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> GMMapElementResponse:
    layer = db.query(MapLayer).filter(MapLayer.id == layer_id).first()
    if layer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Layer not found")

    element = MapElement(
        layer_id=layer_id,
        type=payload.type,
        x=payload.x,
        y=payload.y,
        data=payload.data,
        is_visible_to_players=payload.is_visible_to_players,
    )
    db.add(element)
    db.commit()
    db.refresh(element)
    return GMMapElementResponse.model_validate(element)


@router.patch("/maps/elements/{id}", response_model=GMMapElementResponse)
def update_gm_map_element(
    id: int,
    payload: GMMapElementUpdateRequest,
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> GMMapElementResponse:
    element = db.query(MapElement).filter(MapElement.id == id).first()
    if element is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Element not found")

    updates = payload.model_dump(exclude_unset=True)
    for field in ("x", "y", "data", "is_visible_to_players"):
        if field in updates:
            setattr(element, field, updates[field])

    db.commit()
    db.refresh(element)
    return GMMapElementResponse.model_validate(element)


@router.delete("/maps/elements/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_gm_map_element(
    id: int,
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> None:
    element = db.query(MapElement).filter(MapElement.id == id).first()
    if element is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Element not found")

    db.delete(element)
    db.commit()


@router.get("/wiki/categories", response_model=list[WikiCategoryResponse])
def list_wiki_categories_for_gm(
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> list[WikiCategoryResponse]:
    categories = db.query(WikiCategory).order_by(WikiCategory.name.asc()).all()
    return [WikiCategoryResponse.model_validate(category) for category in categories]


@router.get("/wiki/entries", response_model=list[WikiEntryResponse])
def list_wiki_entries_for_gm(
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> list[WikiEntryResponse]:
    entries = db.query(WikiEntry).order_by(WikiEntry.id.asc()).all()
    return [WikiEntryResponse.model_validate(entry) for entry in entries]


@router.post(
    "/wiki/categories",
    response_model=WikiCategoryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_wiki_category(
    payload: WikiCategoryCreateRequest,
    current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> WikiCategoryResponse:
    if payload.parent_id is not None:
        parent = (
            db.query(WikiCategory).filter(WikiCategory.id == payload.parent_id).first()
        )
        if parent is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent category not found",
            )

    category = WikiCategory(
        name=payload.name,
        slug=payload.slug,
        image_url=payload.image_url,
        description=payload.description,
        parent_id=payload.parent_id,
        created_by_id=current_user.id,
    )
    db.add(category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Category slug already exists"
        )
    db.refresh(category)
    return WikiCategoryResponse.model_validate(category)


@router.patch("/wiki/categories/{id}", response_model=WikiCategoryResponse)
def update_wiki_category(
    id: int,
    payload: WikiCategoryUpdateRequest,
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> WikiCategoryResponse:
    category = db.query(WikiCategory).filter(WikiCategory.id == id).first()
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )

    updates = payload.model_dump(exclude_unset=True)
    for field in ("name", "slug", "image_url", "description", "parent_id"):
        if field in updates:
            setattr(category, field, updates[field])

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Category slug already exists"
        )
    db.refresh(category)
    return WikiCategoryResponse.model_validate(category)


@router.post(
    "/wiki/entries",
    response_model=WikiEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_wiki_entry(
    payload: WikiEntryCreateRequest,
    current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> WikiEntryResponse:
    category = (
        db.query(WikiCategory).filter(WikiCategory.id == payload.category_id).first()
    )
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )

    entry = WikiEntry(
        category_id=payload.category_id,
        title=payload.title,
        slug=payload.slug,
        image_url=payload.image_url,
        content=payload.content,
        is_published=payload.is_published,
        is_unlocked=payload.is_unlocked,
        visibility_state=payload.visibility_state,
        tags=payload.tags,
        linked_entry_ids=_extract_linked_entry_ids(db, payload.content),
        created_by_id=current_user.id,
    )
    db.add(entry)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Entry slug already exists"
        )
    db.refresh(entry)
    _emit_wiki_event("wiki_entry_created", entry)
    return WikiEntryResponse.model_validate(entry)


@router.patch("/wiki/entries/{id}", response_model=WikiEntryResponse)
def update_wiki_entry(
    id: int,
    payload: WikiEntryUpdateRequest,
    current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> WikiEntryResponse:
    entry = db.query(WikiEntry).filter(WikiEntry.id == id).first()
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found"
        )

    updates = payload.model_dump(exclude_unset=True)
    if "category_id" in updates:
        category = (
            db.query(WikiCategory)
            .filter(WikiCategory.id == updates["category_id"])
            .first()
        )
        if category is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
            )

    for field in (
        "category_id",
        "title",
        "slug",
        "image_url",
        "content",
        "is_published",
        "is_unlocked",
        "visibility_state",
        "tags",
    ):
        if field in updates:
            setattr(entry, field, updates[field])

    if "content" in updates:
        entry.linked_entry_ids = _extract_linked_entry_ids(db, updates["content"])
    if "title" in updates and "content" not in updates:
        entry.linked_entry_ids = _extract_linked_entry_ids(db, entry.content)
    entry.updated_by_id = current_user.id

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Entry slug already exists"
        )
    db.refresh(entry)
    _emit_wiki_event("wiki_entry_updated", entry)
    return WikiEntryResponse.model_validate(entry)


@router.patch("/wiki/entries/{id}/unlock", response_model=WikiEntryResponse)
def unlock_wiki_entry(
    id: int,
    current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> WikiEntryResponse:
    entry = db.query(WikiEntry).filter(WikiEntry.id == id).first()
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found"
        )

    entry.is_unlocked = True
    if entry.visibility_state == WikiVisibilityState.HIDDEN:
        entry.visibility_state = WikiVisibilityState.FULL
    entry.updated_by_id = current_user.id
    db.commit()
    db.refresh(entry)
    _emit_wiki_event("wiki_entry_unlocked", entry)
    return WikiEntryResponse.model_validate(entry)


@router.delete("/wiki/entries/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wiki_entry(
    id: int,
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> None:
    entry = db.query(WikiEntry).filter(WikiEntry.id == id).first()
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found"
        )

    db.delete(entry)
    db.commit()
