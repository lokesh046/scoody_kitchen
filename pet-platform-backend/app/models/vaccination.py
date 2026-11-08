from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class VaccineSchedule(Base):
    """The rulebook: one row per vaccine per species. Adding a species is adding rows, not code."""

    __tablename__ = "vaccine_schedules"
    __table_args__ = (UniqueConstraint("species", "code", name="uq_vaccine_schedule_species_code"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    species: Mapped[str] = mapped_column(String(30), nullable=False, index=True)  # lowercase: dog, cat, ...
    code: Mapped[str] = mapped_column(String(40), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False, default="core")  # core | non_core
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    first_dose_weeks: Mapped[int] = mapped_column(Integer, nullable=False)  # age at the first dose
    series_doses: Mapped[int] = mapped_column(Integer, nullable=False, default=1)  # doses in the starter series
    series_interval_weeks: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    booster_months: Mapped[int] = mapped_column(Integer, nullable=False, default=12)  # after the starter series; 0 = no booster
    repeat_months: Mapped[int] = mapped_column(Integer, nullable=False, default=12)  # every booster after that; 0 = no repeat
    booster_weeks: Mapped[int | None] = mapped_column(Integer, nullable=True)  # when set, the booster is this many weeks after the last series dose
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # False until one of the platform's vets has signed the rule off; the app shows a "draft" note.
    vet_reviewed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class PetVaccination(Base):
    """One dose an owner has recorded for a pet."""

    __tablename__ = "pet_vaccinations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    pet_id: Mapped[int] = mapped_column(ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    vaccine_code: Mapped[str] = mapped_column(String(40), nullable=False)
    date_given: Mapped[date] = mapped_column(Date, nullable=False)
    clinic_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    batch_number: Mapped[str | None] = mapped_column(String(60), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)  # set only by the upload endpoint
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class VaccinationReminder(Base):
    """Remembers which reminder was already sent so the daily job never repeats itself."""

    __tablename__ = "vaccination_reminders"
    __table_args__ = (
        UniqueConstraint("pet_id", "vaccine_code", "due_date", "kind", name="uq_vaccination_reminder"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    pet_id: Mapped[int] = mapped_column(ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    vaccine_code: Mapped[str] = mapped_column(String(40), nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    kind: Mapped[str] = mapped_column(String(10), nullable=False)  # soon | overdue
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PetVaccineDeclaration(Base):
    """An owner's answer "not vaccinated" or "don't know" for a vaccine, given when adding an older pet.
    It counts as answered (so the history step can be completed) but the vaccine still shows overdue."""

    __tablename__ = "pet_vaccine_declarations"
    __table_args__ = (UniqueConstraint("pet_id", "vaccine_code", name="uq_pet_vaccine_declaration"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    pet_id: Mapped[int] = mapped_column(ForeignKey("pets.id", ondelete="CASCADE"), nullable=False, index=True)
    vaccine_code: Mapped[str] = mapped_column(String(40), nullable=False)
    answer: Mapped[str] = mapped_column(String(20), nullable=False)  # not_vaccinated | unknown
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
