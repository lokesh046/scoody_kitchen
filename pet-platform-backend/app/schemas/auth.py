from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.enums import UserRole


class UserRegister(BaseModel):
    email: EmailStr
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=20)


class MagicLinkRequest(BaseModel):
    email: EmailStr
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)


class MagicLinkVerifyToken(BaseModel):
    token: str


class MagicLinkVerifyCode(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class GoogleOAuthRequest(BaseModel):
    id_token: str


class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    profile_image_url: str | None = None


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    profile_image_url: str | None = None
    auth_provider: str
    is_email_verified: bool
    is_phone_verified: bool
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}


class FirebaseVerifyPhonePayload(BaseModel):
    id_token: str


class OTPRequest(BaseModel):
    phone_number: str

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        import re
        if not re.match(r"^\+[1-9]\d{1,14}$", v):
            raise ValueError("Phone number must be in E.164 format (e.g. +919876543210)")
        return v


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse | None = None