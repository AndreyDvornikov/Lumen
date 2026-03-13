from pydantic import BaseModel, ConfigDict, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user, get_current_gm, get_db
from app.models import Map, MapMarker, User
from app.models.user import UserRole

router = APIRouter(tags=["maps"])


class MapCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    image_url: str = Field(min_length=1, max_length=500)


class MapMarkerCreate(BaseModel):
    map_id: int
    title: str = Field(min_length=1, max_length=150)
    description: str
    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)
    icon_type: str = Field(min_length=1, max_length=64)
    is_visible: bool = False


class MapMarkerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    map_id: int
    title: str
    description: str | None
    x: float
    y: float
    icon_type: str | None
    is_visible: bool
    created_by_id: int


class MapResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    image_url: str | None
    created_by_id: int
    markers: list[MapMarkerResponse]


def _serialize_marker(marker: MapMarker) -> MapMarkerResponse:
    return MapMarkerResponse(
        id=marker.id,
        map_id=marker.map_id,
        title=marker.title,
        description=marker.description,
        x=marker.x_coordinate,
        y=marker.y_coordinate,
        icon_type=marker.icon,
        is_visible=not marker.is_hidden,
        created_by_id=marker.created_by_id,
    )


def _serialize_map(campaign_map: Map, markers: list[MapMarker]) -> MapResponse:
    return MapResponse(
        id=campaign_map.id,
        name=campaign_map.name,
        description=campaign_map.description,
        image_url=campaign_map.image_url,
        created_by_id=campaign_map.created_by_id,
        markers=[_serialize_marker(marker) for marker in markers],
    )


@router.post("/gm/maps", response_model=MapResponse, status_code=status.HTTP_201_CREATED)
def create_map(
    payload: MapCreate,
    current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> MapResponse:
    campaign_map = Map(
        name=payload.name,
        description=payload.description,
        image_url=payload.image_url,
        created_by_id=current_user.id,
    )
    db.add(campaign_map)
    db.commit()
    db.refresh(campaign_map)
    return _serialize_map(campaign_map, [])


@router.post("/gm/map-markers", response_model=MapMarkerResponse, status_code=status.HTTP_201_CREATED)
def create_map_marker(
    payload: MapMarkerCreate,
    current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> MapMarkerResponse:
    campaign_map = db.query(Map).filter(Map.id == payload.map_id).first()
    if campaign_map is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found")

    marker = MapMarker(
        map_id=payload.map_id,
        title=payload.title,
        description=payload.description,
        x_coordinate=payload.x,
        y_coordinate=payload.y,
        icon=payload.icon_type,
        is_hidden=not payload.is_visible,
        created_by_id=current_user.id,
    )
    db.add(marker)
    db.commit()
    db.refresh(marker)
    return _serialize_marker(marker)


@router.patch("/gm/map-markers/{id}/reveal", response_model=MapMarkerResponse)
def reveal_map_marker(
    id: int,
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> MapMarkerResponse:
    marker = db.query(MapMarker).filter(MapMarker.id == id).first()
    if marker is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Marker not found")

    marker.is_hidden = False
    db.commit()
    db.refresh(marker)
    return _serialize_marker(marker)


@router.get("/maps/{map_id}", response_model=MapResponse)
def get_map(
    map_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> MapResponse:
    campaign_map = db.query(Map).filter(Map.id == map_id).first()
    if campaign_map is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found")

    markers_query = db.query(MapMarker).filter(MapMarker.map_id == campaign_map.id)
    if current_user.role != UserRole.GM:
        markers_query = markers_query.filter(MapMarker.is_hidden.is_(False))
    markers = markers_query.order_by(MapMarker.id.asc()).all()
    return _serialize_map(campaign_map, markers)
