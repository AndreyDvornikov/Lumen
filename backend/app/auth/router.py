from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user, get_db
from app.auth.schemas import AuthUserResponse, LoginRequest, RegisterRequest, RegisterResponse, TokenResponse
from app.auth.security import authenticate_user, create_access_token, hash_password
from app.config import get_settings
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> RegisterResponse:
    existing_user = db.query(User).filter((User.email == payload.email) | (User.username == payload.username)).first()
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")

    user = User(
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),
        is_active=True,
        is_admin=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    settings = get_settings()
    token = create_access_token(subject=user.email, secret_key=settings.jwt_secret_key)
    return RegisterResponse(user=AuthUserResponse.model_validate(user), token=TokenResponse(access_token=token))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    settings = get_settings()
    token = create_access_token(subject=user.email, secret_key=settings.jwt_secret_key)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=AuthUserResponse)
def me(current_user: User = Depends(get_current_active_user)) -> AuthUserResponse:
    return AuthUserResponse.model_validate(current_user)
