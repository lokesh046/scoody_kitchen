from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import require_role
from app.models.enums import UserRole
from app.models.user import User
from app.models.vaccination import VaccineSchedule
from app.schemas.vaccine_rule import VaccineRuleCreate, VaccineRuleResponse, VaccineRuleUpdate

router = APIRouter(prefix="/admin/vaccine-rules", tags=["Admin: Vaccine rules"])

# Editing any of these changes what a vet would have signed off, so the review mark is cleared
# unless the same request sets it again.
_REVIEWED_FIELDS = {
    "name", "category", "description", "first_dose_weeks", "series_doses",
    "series_interval_weeks", "booster_months", "repeat_months", "booster_weeks",
}


@router.get("", response_model=list[VaccineRuleResponse])
def list_rules(db: Session = Depends(get_db), admin: User = Depends(require_role(UserRole.ADMIN))):
    stmt = select(VaccineSchedule).order_by(VaccineSchedule.species, VaccineSchedule.sort_order, VaccineSchedule.id)
    return list(db.scalars(stmt).all())


@router.post("", response_model=VaccineRuleResponse, status_code=status.HTTP_201_CREATED)
def create_rule(data: VaccineRuleCreate, db: Session = Depends(get_db), admin: User = Depends(require_role(UserRole.ADMIN))):
    exists = db.scalar(select(VaccineSchedule.id).where(
        VaccineSchedule.species == data.species, VaccineSchedule.code == data.code))
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That vaccine already exists for this species")
    rule = VaccineSchedule(**data.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.patch("/{rule_id}", response_model=VaccineRuleResponse)
def update_rule(rule_id: int, data: VaccineRuleUpdate, db: Session = Depends(get_db),
                admin: User = Depends(require_role(UserRole.ADMIN))):
    rule = db.get(VaccineSchedule, rule_id)
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    changes = data.model_dump(exclude_unset=True)
    for key in ("name", "category", "first_dose_weeks", "series_doses", "series_interval_weeks",
                "booster_months", "repeat_months", "sort_order", "is_active", "vet_reviewed"):
        if key in changes and changes[key] is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{key} cannot be empty")
    schedule_changed = any(k in changes and getattr(rule, k) != changes[k] for k in _REVIEWED_FIELDS)
    for k, v in changes.items():
        setattr(rule, k, v)
    if schedule_changed and "vet_reviewed" not in changes:
        rule.vet_reviewed = False
    db.commit()
    db.refresh(rule)
    return rule
