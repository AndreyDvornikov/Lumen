from pydantic import BaseModel, ConfigDict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user, get_db
from app.models import User, WikiEntry
from app.models.user import UserRole

router = APIRouter(prefix="/wiki", tags=["wiki"])


class WikiEntryListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    title: str
    slug: str
    content: str
    is_published: bool
    is_unlocked: bool
    tags: list[str]


@router.get("/entries", response_model=list[WikiEntryListResponse])
def list_wiki_entries(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[WikiEntryListResponse]:
    query = db.query(WikiEntry)
    if current_user.role != UserRole.GM:
        query = query.filter(WikiEntry.is_unlocked.is_(True))
    entries = query.order_by(WikiEntry.id.asc()).all()
    return [WikiEntryListResponse.model_validate(entry) for entry in entries]
