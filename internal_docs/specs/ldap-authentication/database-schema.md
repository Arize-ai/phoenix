# Database Schema

LDAP users are rows in the `users` table with `auth_method='LDAP'`. The ORM maps them to `LDAPUser`, a polymorphic subclass of `User` next to `LocalUser` and `OAuth2User` (`src/phoenix/db/models.py`).

## Columns by Auth Method

R = required, N = must be NULL, O = optional.

| Column | LOCAL | OAUTH2 | LDAP |
|--------|-------|--------|------|
| `password_hash`, `password_salt` | R | N | N |
| `email` | R | R | O* |
| `ldap_unique_id` | N | N | O* |
| `oauth2_client_id` | N | O | N |
| `oauth2_user_id` | N | O | N |

\* An LDAP row must have `email`, `ldap_unique_id`, or both. A row with neither could never be found again at login.

CHECK constraints enforce every cell of this table.

## Indexes

- `email` is unique across all users. It is nullable, so many LDAP users without email can coexist.
- `ix_users_ldap_unique_id` is a partial unique index on `ldap_unique_id` where `auth_method = 'LDAP' AND ldap_unique_id IS NOT NULL`.
- `ix_users_oauth2_unique` is a partial unique index on the OAuth2 identifiers where `auth_method = 'OAUTH2'`.

Both partial indexes use `postgresql_where` and `sqlite_where`, so they behave the same on both backends.

## No DN Column

Phoenix does not store the user's DN. DNs change when users move between organizational units, so Phoenix identifies users by email or `ldap_unique_id` instead. See [User Identification Strategy](./user-identification-strategy.md).

## History

The first release could not change the `auth_method` CHECK constraint. It stored LDAP users as `auth_method='OAUTH2'` rows with the marker `\ue000LDAP(stopgap)` in `oauth2_client_id` and the unique ID in `oauth2_user_id`. Users without an email got a placeholder of the form `\ue000NULL(stopgap){md5(unique_id)}`, because `email` was `NOT NULL`.

Migration `a1b2c3d4e5f6` (January 2026) replaced that layout with the one above:

1. It added `'LDAP'` to the `auth_method` CHECK constraint.
2. It added `ldap_unique_id` and moved the unique IDs out of `oauth2_user_id`.
3. It set `auth_method='LDAP'` and cleared `oauth2_client_id` and `oauth2_user_id` on the marked rows.
4. It made `email` nullable and replaced placeholder emails with NULL.

`tests/integration/db_migrations/test_data_migration_a1b2c3d4e5f6_ldap_schema_migration.py` covers the upgrade and the downgrade.
