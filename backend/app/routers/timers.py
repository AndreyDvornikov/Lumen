from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_gm, get_db
from app.models import GameState, Timer, TimerTrigger, User

router = APIRouter(tags=["timers"])


class TimerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=140)
    duration_seconds: int = Field(gt=0)
    is_running: bool = False


class AddTimeRequest(BaseModel):
    seconds: int


class DarknessLevelUpdate(BaseModel):
    level: int = Field(ge=1, le=8)


class TimerTriggerCreate(BaseModel):
    threshold_seconds: int = Field(ge=0)
    color: str = Field(min_length=1, max_length=32)


class TimerTriggerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timer_id: int
    threshold_seconds: int
    color: str


class TimerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    duration_seconds: int
    remaining_seconds: int
    is_running: bool
    is_paused: bool
    triggers: list[TimerTriggerResponse]


class DarknessLevelResponse(BaseModel):
    level: int
    multiplier: float


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _get_or_create_game_state(db: Session) -> GameState:
    state = db.query(GameState).filter(GameState.id == 1).first()
    if state is None:
        state = GameState(id=1, darkness_level=2)
        db.add(state)
        db.flush()
    return state


def _timer_multiplier(level: int) -> float:
    return 2 ** (level - 2)


def _trigger_to_response(trigger: TimerTrigger) -> TimerTriggerResponse:
    color = trigger.payload.get("color", "yellow")
    return TimerTriggerResponse(
        id=trigger.id,
        timer_id=trigger.timer_id,
        threshold_seconds=trigger.trigger_at_seconds,
        color=str(color),
    )


def _timer_to_response(timer: Timer) -> TimerResponse:
    ordered = sorted(timer.triggers, key=lambda t: t.trigger_at_seconds, reverse=True)
    return TimerResponse(
        id=timer.id,
        name=timer.name,
        duration_seconds=timer.duration_seconds,
        remaining_seconds=timer.remaining_seconds,
        is_running=timer.is_running,
        is_paused=timer.is_paused,
        triggers=[_trigger_to_response(trigger) for trigger in ordered],
    )


def _sync_timer(timer: Timer, multiplier: float, now: datetime | None = None) -> None:
    if not timer.is_running or timer.started_at is None:
        return

    current = now or _now()
    elapsed_seconds = (current - timer.started_at).total_seconds()
    adjusted_elapsed = int(elapsed_seconds * multiplier)
    if adjusted_elapsed <= 0:
        return

    # Persist a checkpoint so remaining time survives restarts.
    timer.remaining_seconds = max(0, timer.remaining_seconds - adjusted_elapsed)
    if timer.remaining_seconds == 0:
        timer.is_running = False
        timer.is_paused = False
        timer.started_at = None
        timer.paused_at = current
    else:
        timer.started_at = current


@router.post("/gm/timers", response_model=TimerResponse, status_code=status.HTTP_201_CREATED)
def create_timer(
    payload: TimerCreate,
    current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> TimerResponse:
    now = _now()
    timer = Timer(
        name=payload.name,
        duration_seconds=payload.duration_seconds,
        remaining_seconds=payload.duration_seconds,
        is_running=payload.is_running,
        is_paused=not payload.is_running,
        started_at=now if payload.is_running else None,
        paused_at=now if not payload.is_running else None,
        created_by_id=current_user.id,
    )
    db.add(timer)
    db.commit()
    db.refresh(timer)
    return _timer_to_response(timer)


@router.post("/gm/timers/{id}/start", response_model=TimerResponse)
def start_timer(
    id: int,
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> TimerResponse:
    timer = db.query(Timer).filter(Timer.id == id).first()
    if timer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timer not found")
    if timer.remaining_seconds <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Timer has already finished")

    timer.is_running = True
    timer.is_paused = False
    timer.started_at = _now()
    timer.paused_at = None
    db.commit()
    db.refresh(timer)
    return _timer_to_response(timer)


@router.post("/gm/timers/{id}/pause", response_model=TimerResponse)
def pause_timer(
    id: int,
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> TimerResponse:
    state = _get_or_create_game_state(db)

    timer = db.query(Timer).filter(Timer.id == id).first()
    if timer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timer not found")

    now = _now()
    _sync_timer(timer, _timer_multiplier(state.darkness_level), now)
    timer.is_running = False
    timer.is_paused = True
    timer.started_at = None
    timer.paused_at = now
    db.commit()
    db.refresh(timer)
    return _timer_to_response(timer)


@router.patch("/gm/timers/{id}/add-time", response_model=TimerResponse)
def add_time_to_timer(
    id: int,
    payload: AddTimeRequest,
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> TimerResponse:
    state = _get_or_create_game_state(db)

    timer = db.query(Timer).filter(Timer.id == id).first()
    if timer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timer not found")

    _sync_timer(timer, _timer_multiplier(state.darkness_level), _now())
    timer.remaining_seconds = max(0, timer.remaining_seconds + payload.seconds)
    if timer.remaining_seconds == 0:
        timer.is_running = False
        timer.is_paused = False
        timer.started_at = None
        timer.paused_at = _now()
    db.commit()
    db.refresh(timer)
    return _timer_to_response(timer)


@router.post("/gm/timers/pause-all", response_model=list[TimerResponse])
def pause_all_timers(
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> list[TimerResponse]:
    state = _get_or_create_game_state(db)

    now = _now()
    multiplier = _timer_multiplier(state.darkness_level)
    timers = db.query(Timer).order_by(Timer.id.asc()).all()
    for timer in timers:
        if timer.is_running:
            _sync_timer(timer, multiplier, now)
            timer.is_running = False
            timer.is_paused = True
            timer.started_at = None
            timer.paused_at = now
    db.commit()
    for timer in timers:
        db.refresh(timer)
    return [_timer_to_response(timer) for timer in timers]


@router.post("/gm/timers/resume-all", response_model=list[TimerResponse])
def resume_all_timers(
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> list[TimerResponse]:
    now = _now()
    timers = db.query(Timer).filter(Timer.is_paused.is_(True), Timer.remaining_seconds > 0).order_by(Timer.id.asc()).all()
    for timer in timers:
        timer.is_running = True
        timer.is_paused = False
        timer.started_at = now
        timer.paused_at = None
    db.commit()
    for timer in timers:
        db.refresh(timer)
    return [_timer_to_response(timer) for timer in timers]


@router.post("/gm/timers/end-round", response_model=list[TimerResponse])
def end_round(
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
    round_seconds: int = Query(default=30, ge=1),
) -> list[TimerResponse]:
    state = _get_or_create_game_state(db)

    multiplier = _timer_multiplier(state.darkness_level)
    decrement = int(round_seconds * multiplier)
    timers = db.query(Timer).filter(Timer.is_running.is_(True)).order_by(Timer.id.asc()).all()
    now = _now()

    for timer in timers:
        _sync_timer(timer, multiplier, now)
        timer.remaining_seconds = max(0, timer.remaining_seconds - decrement)
        if timer.remaining_seconds == 0:
            timer.is_running = False
            timer.is_paused = False
            timer.started_at = None
            timer.paused_at = now
        else:
            timer.started_at = now

    db.commit()
    for timer in timers:
        db.refresh(timer)
    return [_timer_to_response(timer) for timer in timers]


@router.patch("/gm/darkness-level", response_model=DarknessLevelResponse)
def set_darkness_level(
    payload: DarknessLevelUpdate,
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> DarknessLevelResponse:
    state = _get_or_create_game_state(db)
    state.darkness_level = payload.level
    db.commit()
    return DarknessLevelResponse(level=state.darkness_level, multiplier=_timer_multiplier(state.darkness_level))


@router.post("/gm/timers/{id}/triggers", response_model=TimerTriggerResponse, status_code=status.HTTP_201_CREATED)
def create_timer_trigger(
    id: int,
    payload: TimerTriggerCreate,
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> TimerTriggerResponse:
    timer = db.query(Timer).filter(Timer.id == id).first()
    if timer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timer not found")

    trigger = TimerTrigger(
        timer_id=timer.id,
        name=f"{payload.color} at {payload.threshold_seconds}s",
        trigger_at_seconds=payload.threshold_seconds,
        event_type="color_threshold",
        payload={"color": payload.color},
    )
    db.add(trigger)
    db.commit()
    db.refresh(trigger)
    return _trigger_to_response(trigger)


@router.get("/gm/timers", response_model=list[TimerResponse])
def list_timers(
    _current_user: User = Depends(get_current_gm),
    db: Session = Depends(get_db),
) -> list[TimerResponse]:
    state = _get_or_create_game_state(db)

    now = _now()
    multiplier = _timer_multiplier(state.darkness_level)
    timers = db.query(Timer).order_by(Timer.id.asc()).all()
    for timer in timers:
        _sync_timer(timer, multiplier, now)
    db.commit()
    for timer in timers:
        db.refresh(timer)
    return [_timer_to_response(timer) for timer in timers]
