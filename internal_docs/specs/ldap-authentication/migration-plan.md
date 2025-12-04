# Future Migration: Stopgap → Dedicated LDAP Schema

**Context**: Phoenix initially ships LDAP using a stopgap approach that reuses OAuth2 columns. This document describes the future migration to a dedicated LDAP schema when/if we decide it's worth the effort.

---

## Current Implementation (Stopgap)

Phoenix stores LDAP users using existing OAuth2 columns:

| Field | Value | Purpose |
|-------|-------|---------|
| `auth_method` | `'OAUTH2'` | Satisfies existing CHECK constraint |
| `oauth2_client_id` | `'\ue000LDAP(stopgap)'` | Unicode marker identifying LDAP users |
| `oauth2_user_id` | `<unique_id>` or `NULL` | Immutable LDAP ID (if configured) or NULL (email-based) |
| `email` | `user@example.com` | Email (unique constraint, primary identifier in simple mode) |

**Identification Strategy** (see [User Identification Strategy](./user-identification-strategy.md)):

| Mode | `oauth2_user_id` | Lookup |
|------|------------------|--------|
| Simple (default) | `NULL` | By email column |
| Enterprise | objectGUID/entryUUID | By oauth2_user_id, fallback to email |

---

## Future Migration (Dedicated Schema)

**When to Migrate**: You've decided a clean schema is worth the migration cost.

**Why Migrate**:
- ✅ Semantic clarity: `auth_method='LDAP'` instead of `'OAUTH2'`
- ✅ Type safety: Dedicated `LDAPUser` class with polymorphism
- ✅ No OAuth2 column pollution
- ⚠️ Requires database migration and downtime

**Schema Changes**:

```sql
-- Step 1: Allow 'LDAP' as auth_method
ALTER TABLE users DROP CONSTRAINT users_auth_method_check;
ALTER TABLE users ADD CONSTRAINT users_auth_method_check
    CHECK (auth_method IN ('LOCAL', 'OAUTH2', 'LDAP'));

-- Step 2: Migrate LDAP users
UPDATE users 
SET auth_method = 'LDAP'
WHERE oauth2_client_id = E'\uE000LDAP(stopgap)';

-- Step 3: Update field validation (oauth2_user_id may be NULL for email-based users)
ALTER TABLE users ADD CONSTRAINT users_ldap_check CHECK (
    (auth_method = 'LDAP' AND oauth2_client_id = E'\uE000LDAP(stopgap)')
    OR (auth_method != 'LDAP')
);
```

**Code Changes**:

```python
# Before (stopgap)
def is_ldap_user(oauth2_client_id: str) -> bool:
    return oauth2_client_id == LDAP_CLIENT_ID_MARKER

# After (dedicated)
user = await session.scalar(
    select(models.User)
    .where(models.User.auth_method == "LDAP")
    .where(...)  # lookup by unique_id or email
)
```

---

## Migration Script

```python
"""Migrate LDAP users to auth_method='LDAP'.

Revision ID: ldap_dedicated_schema
"""
from alembic import op
from sqlalchemy.sql import text

LDAP_MARKER = "\ue000LDAP(stopgap)"

def upgrade():
    conn = op.get_bind()
    
    # Step 1: Update CHECK constraint to allow 'LDAP'
    op.drop_constraint('users_auth_method_check', 'users', type_='check')
    op.create_check_constraint(
        'users_auth_method_check',
        'users',
        "auth_method IN ('LOCAL', 'OAUTH2', 'LDAP')"
    )
    
    # Step 2: Migrate LDAP users
    result = conn.execute(text("""
        UPDATE users
        SET auth_method = 'LDAP'
        WHERE oauth2_client_id = :marker
    """), {"marker": LDAP_MARKER})
    
    print(f"✓ Migrated {result.rowcount} LDAP users to auth_method='LDAP'")

def downgrade():
    conn = op.get_bind()
    
    # Revert auth_method
    conn.execute(text("""
        UPDATE users
        SET auth_method = 'OAUTH2'
        WHERE auth_method = 'LDAP'
    """))
    
    # Restore original constraint
    op.drop_constraint('users_auth_method_check', 'users', type_='check')
    op.create_check_constraint(
        'users_auth_method_check',
        'users',
        "auth_method IN ('LOCAL', 'OAUTH2')"
    )
    
    print("✓ Reverted LDAP users to stopgap format")
```

---

## Validation

### Pre-Migration

```sql
-- Count LDAP users
SELECT COUNT(*) FROM users WHERE oauth2_client_id = E'\uE000LDAP(stopgap)';

-- Check identifier distribution
SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE oauth2_user_id IS NOT NULL) as with_unique_id,
    COUNT(*) FILTER (WHERE oauth2_user_id IS NULL) as email_only
FROM users 
WHERE oauth2_client_id = E'\uE000LDAP(stopgap)';
```

### Post-Migration

```sql
-- Verify all LDAP users migrated
SELECT COUNT(*) FROM users WHERE auth_method = 'LDAP';

-- Should match pre-migration count
SELECT COUNT(*) FROM users WHERE oauth2_client_id = E'\uE000LDAP(stopgap)';
```

---

## When to Migrate

**Stay on stopgap if**:
- ✅ Current implementation working well
- ✅ Don't need `auth_method='LDAP'` for queries/reporting
- ✅ Not worth migration coordination effort

**Migrate when**:
- ✅ Want semantic clarity (`auth_method='LDAP'`)
- ✅ Want type-safe `LDAPUser` class with polymorphism
- ✅ Ready to coordinate migration across deployments

**Note**: The stopgap approach is fully functional. Migration is optional cleanup, not a requirement.

---

## Summary

| Aspect | Stopgap (Current) | Dedicated (Future) |
|--------|-------------------|-------------------|
| `auth_method` | `'OAUTH2'` | `'LDAP'` |
| Detection | `oauth2_client_id == marker` | `auth_method == 'LDAP'` |
| Identifier | email or unique_id | email or unique_id (unchanged) |
| Polymorphism | No | Yes (`LDAPUser` class) |
| Migration | None | ~1 day effort |

**Key Point**: Identification strategy (email/unique_id) is unchanged. Migration only affects schema semantics.
