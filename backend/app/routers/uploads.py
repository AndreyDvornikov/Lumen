from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.auth.dependencies import get_current_active_user
from app.models import User

router = APIRouter(prefix="/uploads", tags=["uploads"])

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "static" / "uploads"
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
}


class ImageUploadResponse(BaseModel):
    url: str


@router.post("/image", response_model=ImageUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_image(
    file: UploadFile = File(...),
    _current_user: User = Depends(get_current_active_user),
) -> ImageUploadResponse:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported image type")

    payload = await file.read()
    if len(payload) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image exceeds 10 MB limit")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{ALLOWED_IMAGE_TYPES[file.content_type]}"
    destination = UPLOAD_DIR / filename
    destination.write_bytes(payload)

    return ImageUploadResponse(url=f"/static/uploads/{filename}")
