from enum import Enum

class UserRole(str, Enum):
    CUSTOMER = "customer"
    DOCTOR = "doctor"
    ADMIN = "admin"


