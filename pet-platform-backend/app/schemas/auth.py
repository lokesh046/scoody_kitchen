from pydantic import BaseModel, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length= 8,max_length= 128)
    first_name: str = Field(min_length= 1,max_length= 100)
    last_name: str | None  = Field(default=None,max_length= 100)
    phone: str | None = Field(default=None, max_length=20)


class UserResponse(BaseModel):
    id: int
    email:EmailStr
    first_name: str
    last_name: str | None
    phone: str | None
    role: str
    is_active: bool


class UserLogin(BaseModel):
    email: EmailStr
    password: set

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


    model_config = {
        "from_attributes" : True
    }