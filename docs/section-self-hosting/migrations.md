---
description: Migrations are run at boot
---
# Migrations

New major versions of Phoenix may contain database migrations that run automatically upon the start of the application. This process is intended to be seamless and should not require manual intervention except in exceptional circumstances.

All migrations are documented in the main [MIGRATION doc](https://github.com/Arize-ai/phoenix/blob/main/MIGRATION.md)

## Migration Reliability & Testing

Phoenix takes database migration reliability seriously and follows strict practices to minimize risk:

- **Comprehensive Testing**: All migrations are thoroughly tested in CI, including both up and down migration paths. See our [migration test suite](https://github.com/Arize-ai/phoenix/blob/main/tests/integration/db_migrations/test_up_and_down_migrations.py) for details.

- **Conservative Migration Policy**: Migrations are only performed during major version bumps (e.g., v8.x to v9.0.0), giving clear advance notice of schema changes.

In the case that you may need to manually apply migration, debug builds are provided for shell access.

