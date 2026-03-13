from app.routers.characters import router as characters_router
from app.routers.gm import router as gm_router
from app.routers.maps import router as maps_router
from app.routers.timers import router as timers_router
from app.routers.wiki import router as wiki_router

__all__ = ["characters_router", "gm_router", "maps_router", "timers_router", "wiki_router"]
