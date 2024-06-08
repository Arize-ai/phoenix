from starlette.schemas import SchemaGenerator

openapi_schema_generator = SchemaGenerator(
    {"openapi": "3.0.0", "info": {"title": "Arize-Phoenix API", "version": "1.0"}}
)
