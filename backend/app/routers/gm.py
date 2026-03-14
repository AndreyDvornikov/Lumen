import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_gm, get_db
from app.models import User, WikiCategory, WikiEntry, WikiVisibilityState
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
            "visibilityState": entry.visibility_state.value,
            "title": entry.title,
        },
    )


@router.get("/test")
def gm_test(_current_user: User = Depends(get_current_gm)) -> dict[str, str]:
    return {"message": "GM access granted"}


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
