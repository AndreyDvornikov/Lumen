from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user, get_db
from app.models import User, WikiCategory, WikiEntry, WikiVisibilityState
from app.models.user import UserRole

router = APIRouter(prefix="/wiki", tags=["wiki"])


class WikiCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    image_url: str | None
    description: str | None
    parent_id: int | None
    created_at: datetime


class WikiEntryListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    title: str
    slug: str
    image_url: str | None
    excerpt: str | None
    is_published: bool
    is_unlocked: bool
    visibility_state: WikiVisibilityState
    tags: list[str]
    linked_entry_ids: list[int]
    linked_entries: list[dict[str, int | str]]
    created_at: datetime


class WikiEntryDetailResponse(WikiEntryListResponse):
    content: str


def _can_access_full_entry(entry: WikiEntry, current_user: User) -> bool:
    if current_user.role == UserRole.GM:
        return True
    if current_user.role == UserRole.PLAYER and not entry.is_unlocked:
        return False
    if not entry.is_published:
        return False
    if entry.visibility_state == WikiVisibilityState.HIDDEN:
        return False
    if entry.visibility_state == WikiVisibilityState.TITLE_ONLY:
        return False
    return True


def _is_list_visible(entry: WikiEntry, current_user: User) -> bool:
    if current_user.role == UserRole.GM:
        return True
    if current_user.role == UserRole.PLAYER:
        return (
            entry.is_unlocked and entry.visibility_state != WikiVisibilityState.HIDDEN
        )
    return False  # гостей больше нет


def _entry_excerpt(entry: WikiEntry, current_user: User) -> str | None:
    if current_user.role == UserRole.GM:
        return entry.content[:180]
    if entry.visibility_state == WikiVisibilityState.TITLE_ONLY:
        return None
    return entry.content[:180]


def _entry_list_response(
    entry: WikiEntry, current_user: User, db: Session
) -> WikiEntryListResponse:
    related_entries = (
        db.query(WikiEntry).filter(WikiEntry.id.in_(entry.linked_entry_ids)).all()
        if entry.linked_entry_ids
        else []
    )

    return WikiEntryListResponse(
        id=entry.id,
        category_id=entry.category_id,
        title=entry.title,
        slug=entry.slug,
        image_url=entry.image_url,
        excerpt=_entry_excerpt(entry, current_user),
        is_published=entry.is_published,
        is_unlocked=entry.is_unlocked,
        visibility_state=entry.visibility_state,
        tags=entry.tags,
        linked_entry_ids=entry.linked_entry_ids,
        linked_entries=[{"id": e.id, "title": e.title} for e in related_entries],
        created_at=entry.created_at,
    )


@router.get("/categories", response_model=list[WikiCategoryResponse])
def list_wiki_categories(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[WikiCategoryResponse]:
    categories = db.query(WikiCategory).order_by(WikiCategory.name.asc()).all()

    if current_user.role == UserRole.GM:
        return [WikiCategoryResponse.model_validate(c) for c in categories]

    visible_entry_category_ids = {
        entry.category_id
        for entry in db.query(WikiEntry).all()
        if _is_list_visible(entry, current_user)
    }

    return [
        WikiCategoryResponse.model_validate(category)
        for category in categories
        if category.id in visible_entry_category_ids
    ]


@router.get("/entries", response_model=list[WikiEntryListResponse])
def list_wiki_entries(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[WikiEntryListResponse]:
    entries = db.query(WikiEntry).order_by(WikiEntry.id.asc()).all()

    return [
        _entry_list_response(entry, current_user, db)
        for entry in entries
        if _is_list_visible(entry, current_user)
    ]


@router.get("/entries/{id}", response_model=WikiEntryDetailResponse)
def get_wiki_entry(
    id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> WikiEntryDetailResponse:
    entry = db.query(WikiEntry).filter(WikiEntry.id == id).first()

    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found"
        )

    if not _can_access_full_entry(entry, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Entry is not accessible"
        )

    base = _entry_list_response(entry, current_user, db)

    return WikiEntryDetailResponse(
        **base.model_dump(),
        content=entry.content,
    )
