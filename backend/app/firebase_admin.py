import json
import os
from typing import Any

import firebase_admin
from firebase_admin import auth, credentials


_app: firebase_admin.App | None = None


def init_firebase() -> firebase_admin.App | None:
    global _app
    if _app is not None:
        return _app

    if firebase_admin._apps:
        _app = firebase_admin.get_app()
        return _app

    json_str = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if json_str:
        service_account = json.loads(json_str)
        cred = credentials.Certificate(service_account)
        _app = firebase_admin.initialize_app(
            cred,
            options={"storageBucket": os.getenv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET")},
        )
        return _app

    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        _app = firebase_admin.initialize_app(
            cred,
            options={"storageBucket": os.getenv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET")},
        )
        return _app

    return None


def verify_bearer_token(authorization: str | None) -> dict[str, Any] | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None

    app = init_firebase()
    if not app:
        return None

    token = authorization[7:]
    try:
        return auth.verify_id_token(token, app=app)
    except Exception:
        return None
