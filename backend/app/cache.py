import redis

from app.config import get_settings

settings = get_settings()
redis_client = redis.Redis.from_url(settings.redis_dsn, decode_responses=True)
