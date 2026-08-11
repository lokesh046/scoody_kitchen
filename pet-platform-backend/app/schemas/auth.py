from pydantic import BaseModel, EmailStr, Field
from app.models.enums import UserRole

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length= 8,max_length= 128)
    first_name: str = Field(min_length= 1,max_length= 100)
    last_name: str | None  = Field(default=None,max_length= 100)
    phone: str | None = Field(default=None, max_length=20)


class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int 
    email:EmailStr
    first_name: str
    last_name: str | None
    phone: str | None
    role: UserRole
    is_active: bool

    model_config = {
        "from_attributes" : True
    }


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


   