from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user, get_db
from app.models import Map, MapElement, MapLayer, User

router = APIRouter(tags=["maps"])


class MapResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    image_url: str
    width: int
    height: int
    is_visible_to_players: bool
    created_by_id: int


class MapLayerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    map_id: int
    name: str
    order_index: int
    is_visible_to_players: bool


class MapElementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    layer_id: int
    type: str
    x: float
    y: float
    data: dict[str, Any]
    is_visible_to_players: bool


def _map_to_response(campaign_map: Map) -> MapResponse:
    return MapResponse.model_validate(campaign_map)


def _layer_to_response(layer: MapLayer) -> MapLayerResponse:
    return MapLayerResponse.model_validate(layer)


def _element_to_response(element: MapElement) -> MapElementResponse:
    return MapElementResponse.model_validate(element)


@router.get("/maps", response_model=list[MapResponse])
def list_maps(
    _current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[MapResponse]:
    maps = db.query(Map).filter(Map.is_visible_to_players.is_(True)).order_by(Map.id.asc()).all()
    return [_map_to_response(campaign_map) for campaign_map in maps]


@router.get("/maps/{map_id}", response_model=MapResponse)
def get_map(
    map_id: int,
    _current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> MapResponse:
    campaign_map = db.query(Map).filter(Map.id == map_id, Map.is_visible_to_players.is_(True)).first()
    if campaign_map is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found")
    return _map_to_response(campaign_map)


@router.get("/maps/{map_id}/layers", response_model=list[MapLayerResponse])
def list_map_layers(
    map_id: int,
    _current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[MapLayerResponse]:
    campaign_map = db.query(Map).filter(Map.id == map_id, Map.is_visible_to_players.is_(True)).first()
    if campaign_map is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found")

    layers = (
        db.query(MapLayer)
        .filter(MapLayer.map_id == map_id, MapLayer.is_visible_to_players.is_(True))
        .order_by(MapLayer.order_index.asc(), MapLayer.id.asc())
        .all()
    )
    return [_layer_to_response(layer) for layer in layers]


@router.get("/maps/layers/{layer_id}/elements", response_model=list[MapElementResponse])
def list_map_elements(
    layer_id: int,
    _current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[MapElementResponse]:
    layer = db.query(MapLayer).filter(MapLayer.id == layer_id, MapLayer.is_visible_to_players.is_(True)).first()
    if layer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Layer not found")

    if not layer.map.is_visible_to_players:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Map not found")

    elements = (
        db.query(MapElement)
        .filter(MapElement.layer_id == layer_id, MapElement.is_visible_to_players.is_(True))
        .order_by(MapElement.id.asc())
        .all()
    )
    return [_element_to_response(element) for element in elements]
