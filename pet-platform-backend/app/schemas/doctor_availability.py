from datetime import datetime, time
from pydantic import BaseModel, Field, model_validator

from app.models.enums import DayOfWeek


class DoctorAvailabilityCreate(BaseModel):
    day_of_week: DayOfWeek
    start_time: time
    end_time: time
    is_available: bool = True

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.start_time >= self.end_time:
            raise ValueError("start_time must be earlier than end_time")
        return self


class DoctorAvailabilityUpdate(BaseModel):
    start_time: time | None = None
    end_time: time | None = None
    is_available: bool | None = None

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.start_time is not None and self.end_time is not None:
            if self.start_time >= self.end_time:
                raise ValueError("start_time must be earlier than end_time")
        return self


class DoctorAvailabilityResponse(BaseModel):
    id: int
    doctor_id: int
    day_of_week: DayOfWeek
    start_time: time
    end_time: time
    is_available: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BulkScheduleCreate(BaseModel):
    schedule: list[DoctorAvailabilityCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_no_internal_overlaps(self):
        # Group windows by day_of_week
        by_day: dict[DayOfWeek, list[tuple[time, time]]] = {}
        for item in self.schedule:
            if item.day_of_week not in by_day:
                by_day[item.day_of_week] = []
            by_day[item.day_of_week].append((item.start_time, item.end_time))

        # Check overlapping ranges per day
        for day, windows in by_day.items():
            sorted_windows = sorted(windows, key=lambda w: w[0])
            for i in range(len(sorted_windows) - 1):
                curr_start, curr_end = sorted_windows[i]
                next_start, next_end = sorted_windows[i + 1]
                if next_start < curr_end:
                    raise ValueError(
                        f"Bulk schedule contains overlapping windows on {day.value}: "
                        f"{curr_start.strftime('%H:%M')}-{curr_end.strftime('%H:%M')} and "
                        f"{next_start.strftime('%H:%M')}-{next_end.strftime('%H:%M')}"
                    )
        return self


class DoctorSchedulePublicResponse(BaseModel):
    doctor_id: int
    is_accepting_consultations: bool
    schedule: list[DoctorAvailabilityResponse]

    model_config = {"from_attributes": True}
