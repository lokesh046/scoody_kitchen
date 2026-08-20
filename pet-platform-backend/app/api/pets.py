from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi import Query
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.pet import PetCreate, PetResponse, PetUpdate
from app.services.pet_service import (create_pet,delete_pet,get_pet_by_id,update_pet,get_pet_by_user_id)

from app.models.enums import HealthRecordType
from app.schemas.health_record import HealthRecordResponse, PetHealthHistoryResponse
from app.services.health_record_service import (
    get_health_record_by_id,
    get_pet_health_records_for_customer,
)


router = APIRouter(prefix="/pets",tags=["Pets"])

@router.post("",response_model=PetResponse, status_code = status.HTTP_201_CREATED)

def create_new_pet(
    pet_data: PetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    created_pet = create_pet(db,pet_data,current_user.id)

    return created_pet

@router.get("",response_model= list[PetResponse],status_code=status.HTTP_200_OK)

def get_my_pets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):  
    pets = get_pet_by_user_id(db,current_user.id)
    return pets 

@router.get("/{pet_id}",response_model=PetResponse,status_code=status.HTTP_200_OK)
def get_pet_details(
    pet_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    pet = get_pet_by_id(db,pet_id,current_user.id)
    if not pet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pet Not Found"
        )


    return pet    

@router.patch("/{pet_id}",response_model=PetResponse,status_code=status.HTTP_200_OK)
def update_my_pet(
    pet_id: int,
    pet_data: PetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    pet = get_pet_by_id(db,pet_id,current_user.id)

    if pet is None:
        raise HTTPException(status_code = status.HTTP_404_NOT_FOUND, detail = "Pet Not Found")
    
    updated_pet = update_pet(db,pet,pet_data)

    return updated_pet
    

@router.delete("/{pet_id}",status_code=status.HTTP_204_NO_CONTENT)
def delete_my_pet(
    pet_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    pet = get_pet_by_id(db,pet_id,current_user.id)
    if pet is None:
        raise HTTPException(status_code = status.HTTP_404_NOT_FOUND, detail = "Pet Not Found")

    delete_pet(db,pet)
    
    return None


# ==================================================
# CUSTOMER HEALTH RECORDS
# ==================================================



@router.get(
    "/{pet_id}/health-records",
    response_model=PetHealthHistoryResponse,
)
def get_pet_health_history(
    pet_id: int,
    record_type: HealthRecordType | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        records = get_pet_health_records_for_customer(
            db=db,
            customer_id=current_user.id,
            pet_id=pet_id,
            record_type=record_type,
        )
        return {
            "pet_id": pet_id,
            "records": records,
        }
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc).strip("'"))


@router.get(
    "/{pet_id}/health-records/{record_id}",
    response_model=HealthRecordResponse,
)
def get_pet_health_record_detail(
    pet_id: int,
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = get_health_record_by_id(db, record_id)
    if record is None or record.pet_id != pet_id or record.pet.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Health record not found")
    return record
