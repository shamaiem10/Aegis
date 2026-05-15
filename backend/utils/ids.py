import uuid


def new_crisis_id() -> str:
    return f"crs_{uuid.uuid4().hex[:10]}"
