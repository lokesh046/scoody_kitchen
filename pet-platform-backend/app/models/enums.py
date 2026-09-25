from enum import Enum

class UserRole(str, Enum):
    CUSTOMER = "customer"
    DOCTOR = "doctor"
    ADMIN = "admin"


class DayOfWeek(str, Enum):
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"


class ConsultationStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class SupportTicketStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class SupportTicketCategory(str, Enum):
    ORDER_ISSUE = "order_issue"
    CONSULTATION_ISSUE = "consultation_issue"
    PRODUCT_ISSUE = "product_issue"
    PAYMENT = "payment"
    ACCOUNT = "account"
    OTHER = "other"


class HealthRecordType(str, Enum):
    GENERAL = "general"
    SYMPTOM = "symptom"
    DIAGNOSIS = "diagnosis"
    TREATMENT = "treatment"
    VACCINATION = "vaccination"
    MEDICATION = "medication"
    LAB_RESULT = "lab_result"
    SURGERY = "surgery"
    ALLERGY = "allergy"
    FOLLOW_UP = "follow_up"


