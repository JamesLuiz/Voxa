import re

def is_valid_email(email: str) -> bool:
    return bool(re.match(r"^\S+@\S+\.\S+$", email))

def is_valid_phone(phone: str) -> bool:
    digits = re.sub(r"\D", "", phone)
    return bool(digits) and len(digits) >= 10


