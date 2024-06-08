from .schema import get_openapi_schema

if __name__ == "__main__":
    import yaml

    print(yaml.dump(get_openapi_schema(), indent=2))
