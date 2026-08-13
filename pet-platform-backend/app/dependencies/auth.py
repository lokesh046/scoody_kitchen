from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

import jwt
from jwt.exceptions import InvalidTokenError
from sqlalchemy import select


from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

from typing import Callable

from app.models.enums import UserRole


security =  HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials=Depends(security),db:Session=Depends(get_db)):

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms= [settings.JWT_ALGORITHM]
        )

        user_id = payload.get("sub")
        token_type = payload.get("type")

        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
            detail = "Invalid token")


        if token_type != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
            detail = " Invalid access token")

    except InvalidTokenError:
        raise HTTPException(
            status_code= status.HTTP_401_UNAUTHORIZED,
            detail = "Invalid Token"
        )


    user  = db.get(User,int(user_id))

    if user is None:
        raise HTTPException(
            status_code= status.HTTP_404_NOT_FOUND,
            detail = "User not Found"
        )   

    if not user.is_active:
        raise HTTPException(
            status_code= status.HTTP_403_FORBIDDEN,
            detail = "User account is inactive"
        )


    return user     
    
def require_role(required_role: UserRole) -> Callable:
    def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:

        if current_user.role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource",
            )

        return current_user

    return role_checker

require_admin = require_role(UserRole.ADMIN)