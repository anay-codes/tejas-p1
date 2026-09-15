from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.schemas import Token, UserLogin, UserResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
def login(credentials: UserLogin):
    # Standard authorized demo operator credentials
    if credentials.username in ["operator.rawat", "admin", "operator"] and len(credentials.password) >= 3:
        return Token(
            access_token=f"jwt_token_for_{credentials.username}_secure_session",
            token_type="bearer",
            role="ADMIN" if credentials.username == "admin" else "OPERATOR",
            username=credentials.username
        )
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid operator call-sign or token."
    )

@router.get("/me", response_model=UserResponse)
def get_current_user():
    return UserResponse(
        id=1,
        username="operator.rawat",
        role="ADMIN",
        full_name="Cmdr. R. Verma",
        is_active=True
    )
