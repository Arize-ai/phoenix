"""
This file generates the OpenAPI schema of our FastAPI app and saves it to file.
"""

import json

from fastapi.openapi.utils import get_openapi

from chat.app import app

with open("../frontend/schema.json", "w") as f:
    json.dump(
        get_openapi(
            title="Chat Service Schema",
            version="1.0.0",
            description="API schema for chat-service",
            routes=app.routes,
        ),
        f,
        indent=4,
    )
