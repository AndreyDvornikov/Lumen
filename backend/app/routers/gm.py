from pydantic import BaseModel, ConfigDict, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_gm, get_db
from app.models import User, WikiCategory, WikiEntry

router = APIRouter(prefix="/gm", tags=["gm"])


class WikiCategoryCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    slug: str = Field(min_length=1, max_length=180)
    description: str | None = None
    parent_id: int | None = None


class WikiCategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    description: str | None
    parent_id: int | None
    created_by_id: int


class WikiEntryCreateRequest(BaseModel):
    category_id: int
    title: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=240)
    content: str = Field(min_length=1)
    is_published: bool = False
    is_unlocked: bool = False
    tags: list[str] = Field(default_factory=list)


class WikiEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    title: str
    slug: str
    content: str
    is_published: bool
    is_unlocked: bool
    tags: list[str]
    created_by_id: int
    updated_by_id: int | None


@router.get("/test")
def gm_test(_current_user: User = Depends(get_current_gm)) -> dict[str, str]:
    return {"message": "GM access granted"}


@router.post("/wiki/categories", response_model=WikiCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_wiki_category(
    payload: WikiCategoryCreateRequest,
    current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> WikiCategoryResponse:
    if payload.parent_id is not None:
        parent = db.query(WikiCategory).filter(WikiCategory.id == payload.parent_id).first()
        if parent is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent category not found")

    category = WikiCategory(
        name=payload.name,
        slug=payload.slug,
        description=payload.description,
        parent_id=payload.parent_id,
        created_by_id=current_user.id,
    )
    db.add(category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category slug already exists")
    db.refresh(category)
    return WikiCategoryResponse.model_validate(category)


@router.post("/wiki/entries", response_model=WikiEntryResponse, status_code=status.HTTP_201_CREATED)
def create_wiki_entry(
    payload: WikiEntryCreateRequest,
    current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> WikiEntryResponse:
    category = db.query(WikiCategory).filter(WikiCategory.id == payload.category_id).first()
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    entry = WikiEntry(
        category_id=payload.category_id,
        title=payload.title,
        slug=payload.slug,
        content=payload.content,
        is_published=payload.is_published,
        is_unlocked=payload.is_unlocked,
        tags=payload.tags,
        created_by_id=current_user.id,
    )
    db.add(entry)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Entry slug already exists")
    db.refresh(entry)
    return WikiEntryResponse.model_validate(entry)


@router.patch("/wiki/entries/{id}/unlock", response_model=WikiEntryResponse)
def unlock_wiki_entry(
    id: int,
    current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> WikiEntryResponse:
    entry = db.query(WikiEntry).filter(WikiEntry.id == id).first()
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

    entry.is_unlocked = True
    entry.updated_by_id = current_user.id
    db.commit()
    db.refresh(entry)
    return WikiEntryResponse.model_validate(entry)
