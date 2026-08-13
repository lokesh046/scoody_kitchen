from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.pet import Pet
from app.schemas.pet import PetCreate, PetUpdate


def create_pet(
    db:Session,
    pet_data: PetCreate,
    user_id: int,

) -> Pet:

    pet = Pet(
        user_id = user_id,
        name=pet_data.name,
        species=pet_data.species,
        breed=pet_data.breed,
        gender=pet_data.gender,
        date_of_birth=pet_data.date_of_birth,
        weight=pet_data.weight,
    )


    db.add(pet)
    db.commit()
    db.refresh(pet)


    return pet


def get_pet_by_user_id(
    db:Session,
    user_id: int
)-> list[Pet]:


    statement = select(Pet).where(Pet.user_id == user_id)


    return list(db.scalars(statement).all())


def get_pet_by_id(db:Session, pet_id:int,user_id: int) -> Pet | None:

    statement = select(Pet).where(Pet.id == pet_id,Pet.user_id==user_id)

    return db.scalar(statement)

def update_pet(
    db: Session,
    pet: Pet,
    pet_data: PetUpdate,
) -> Pet:

    update_data = pet_data.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():
        setattr(pet, field, value)

    db.commit()
    db.refresh(pet)

    return pet


def delete_pet(
    db: Session,
    pet: Pet,
) -> None:

    db.delete(pet)
    db.commit()