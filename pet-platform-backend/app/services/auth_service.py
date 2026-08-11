from app.migrations.versions import b38cab778cf7_create_users_table
from sqlalchemy import select
from sqlalchemy.orm import  Session


from app.core.security import hash_password
from app.models.user import User
from app.schemas.auth import UserRegister

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
        phone=user_data.phone,)

    db.add(user)
    db.commit()
    db.refresh(user)
    return user

    
    