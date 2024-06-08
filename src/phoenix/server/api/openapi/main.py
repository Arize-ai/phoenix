import json

from .schema import get_openapi_schema

if __name__ == "__main__":
    print(json.dumps(get_openapi_schema(), indent=2))
