from fastapi import APIRouter, Depends

from app.dependencies.auth import require_role
from app.models.enums import UserRole 
from app.models.user import User


router  = APIRouter(
    prefix='/admin',
    tags=["Admin"]
)


@router.get("/test")

def admin_test(
    current_user: User = Depends(
        require_role(UserRole.ADMIN)
    )
):

    return {
        "message": "Admin access granted",
        "user_id": current_user.id,
        "role" : current_user.role

    }