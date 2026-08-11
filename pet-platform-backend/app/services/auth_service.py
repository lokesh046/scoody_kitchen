from app.migrations.versions import b38cab778cf7_create_users_table
from sqlalchemy import select
from sqlalchemy.orm import  Session

from app.models.enums import UserRole


from app.core.security import (hash_password,
    create_refresh_token,
    create_access_token,
    verify_password,
    hash_token)


from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import UserRegister,UserLogin

def get_user_by_email(db: Session,
    email: str) -> User | None :

    statement = select(User).where(User.email == email)
    

    return db.scalar(statement)


def create_user(
    db:Session,
    user_data: UserRegister
    )-> User:

    user = User(email=user_data.email,
        password_hash=hash_password(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone,
        role=UserRole.CUSTOMER)

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(

    db: Session,
    email:str,
    password: str )-> User |None:

    user = get_user_by_email(db,email)

    if not user:
        return None
    
    if not  verify_password(password,user.password_hash):
        return None
    
    return user 

def create_tokens(db:Session,user: User) -> dict[str,str]:

    access_token = create_access_token(user.id)

    refresh_token,refresh_expire = create_refresh_token(user.id)

    refresh_token_record = RefreshToken(
        user_id = user.id,
        token_hash = hash_token(refresh_token),
        expires_at= refresh_expire
        
    )
    db.add(refresh_token_record)
    db.commit()


    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }









    
    