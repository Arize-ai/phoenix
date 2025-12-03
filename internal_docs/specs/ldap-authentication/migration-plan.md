# Approach 1 → 2 Migration Plan

**Context**: If you choose Approach 1 (zero-migration) initially, this appendix provides migration plans for moving to Approach 2 (dedicated LDAP columns) later.

---

## Current Implementation (Approach 1)

Phoenix stores LDAP users using the OAuth2 columns:

| Field | Value | Purpose |
|-------|-------|---------|
| `auth_method` | `'OAUTH2'` | Satisfies existing CHECK constraint |
| `oauth2_client_id` | `'\ue000LDAP(stopgap)'` | Unicode marker identifying LDAP users |
| `oauth2_user_id` | `<canonical_dn>` | **RFC 4514 canonicalized DN** (primary identifier) |
| `email` | `user@example.com` | Email (unique constraint, fallback for admin-provisioned users) |

**Key Design**: DN is the **stable primary identifier**. Email is used as fallback only for admin-provisioned users (who have `oauth2_user_id=NULL` initially).

**DN Canonicalization**: All DNs are normalized per RFC 4514 before storage:
- Lowercase attribute types and values
- Whitespace normalization
- Multi-valued RDN alphabetical ordering
- Escaped character preservation

Example:
```
Raw DN:     "UID=John,  OU=Users, DC=Example, DC=Com"
Canonical:  "uid=john,ou=users,dc=example,dc=com"
```

This prevents duplicate accounts from DN case/whitespace variations.

---

## Approach 2 Migration

**When to Migrate**: You've decided Approach 2's clean schema is worth the migration cost.

**When NOT to Migrate**: If you want polymorphism but aren't ready for full cleanup, **stay on Approach 1** - don't do a partial migration. A halfway migration gives you all the cost (downtime, coordination) with none of the benefit (still have OAuth2 column pollution).

**Additional Changes**:
```sql
-- Make ldap_dn required for LDAP users
ALTER TABLE users ADD COLUMN ldap_dn VARCHAR;

-- Migrate DN data
UPDATE users 
SET auth_method = 'LDAP',
    ldap_dn = oauth2_user_id,
    oauth2_client_id = NULL,
    oauth2_user_id = NULL
WHERE oauth2_client_id = E'\uE000LDAP';

-- Add constraint
ALTER TABLE users ADD CONSTRAINT users_ldap_fields_check CHECK (
    (auth_method = 'LDAP' AND ldap_dn IS NOT NULL 
     AND oauth2_client_id IS NULL AND oauth2_user_id IS NULL)
    OR (auth_method != 'LDAP')
);
```

**Result**:
- ✅ **True "clean schema"**: Complete LDAP/OAuth2 separation
- ✅ **Semantic clarity**: `ldap_dn` column self-documents purpose
- ✅ **No technical debt**: Aligns with Approach 2's stated goals
- ✅ **Type safety**: `LDAPUser` class with proper columns
- ⚠️ More invasive migration (but you're already migrating for Approach 2)

---

## Migration Script (Option A - Recommended)

```python
"""Migrate LDAP users to dedicated auth_method='LDAP'.

Revision ID: ldap_migration_001
"""
from alembic import op
import sqlalchemy as sa
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
    
    # Step 2: Optional - Add ldap_dn column for clarity
    op.add_column('users', sa.Column('ldap_dn', sa.VARCHAR(), nullable=True))
    
    # Step 3: Migrate LDAP users
    conn.execute(text("""
        UPDATE users
        SET auth_method = 'LDAP',
            ldap_dn = oauth2_user_id  -- Preserve canonicalized DN
        WHERE oauth2_client_id = :marker
    """), {"marker": LDAP_MARKER})
    
    # Step 4: Update field validation constraint
    op.drop_constraint('users_auth_method_check1', 'users', type_='check')
    op.create_check_constraint(
        'users_auth_method_check1',
        'users',
        """(auth_method = 'LOCAL' AND password_hash IS NOT NULL)
        OR (auth_method = 'OAUTH2' AND oauth2_client_id IS NOT NULL 
            AND oauth2_user_id IS NOT NULL)
        OR (auth_method = 'LDAP' AND oauth2_client_id = :ldap_marker)""",
        bind_params={"ldap_marker": LDAP_MARKER}
    )
    
    print(f"✓ Migrated LDAP users to auth_method='LDAP'")

def downgrade():
    conn = op.get_bind()
    
    # Restore LDAP users to Approach 1 format
    conn.execute(text("""
        UPDATE users
        SET auth_method = 'OAUTH2'
        WHERE auth_method = 'LDAP'
    """))
    
    # Restore original constraints
    op.drop_constraint('users_auth_method_check1', 'users', type_='check')
    op.create_check_constraint(
        'users_auth_method_check1',
        'users',
        """(auth_method = 'LOCAL' AND password_hash IS NOT NULL)
        OR (auth_method != 'LOCAL')"""
    )
    
    op.drop_constraint('users_auth_method_check', 'users', type_='check')
    op.create_check_constraint(
        'users_auth_method_check',
        'users',
        "auth_method IN ('LOCAL', 'OAUTH2')"
    )
    
    op.drop_column('users', 'ldap_dn')
    
    print(f"✓ Reverted LDAP users to Approach 1")
```

---

## Code Changes After Migration

### Add LDAPUser Class

```python
# src/phoenix/db/models.py

class LDAPUser(User):
    """LDAP-authenticated user with DN-based identification."""
    
    __mapper_args__ = {"polymorphic_identity": "LDAP"}
    
    def __init__(
        self,
        *,
        email: str,
        username: str,
        user_dn: str,  # Canonicalized DN
        user_role_id: Optional[int] = None,
    ) -> None:
        from phoenix.server.ldap import canonicalize_dn
        
        canonical_dn = canonicalize_dn(user_dn)
        
        super().__init__(
            email=email,
            username=username,
            user_role_id=user_role_id,
            reset_password=False,
            auth_method="LDAP",
            oauth2_client_id=LDAP_CLIENT_ID_MARKER,
            oauth2_user_id=canonical_dn,  # DN stored here
            ldap_dn=canonical_dn,  # Optional: duplicate for clarity
        )
```

### Update Authentication Logic

```python
# src/phoenix/server/api/routers/auth.py

async def _get_or_create_ldap_user(
    session: AsyncSession,
    user_info: LDAPUserInfo,
    role_name: str,
) -> models.User:
    """Get or create LDAP user (DN-based lookup)."""
    from phoenix.server.ldap import canonicalize_dn
    
    user_dn_canonical = canonicalize_dn(user_info.user_dn)
    email = user_info.email.lower()
    
    # PRIMARY: Look up by canonical DN
    user = await session.scalar(
        select(models.User)
        .where(models.User.auth_method == "LDAP")  # NEW: Use LDAP directly
        .where(models.User.oauth2_user_id == user_dn_canonical)
        .options(joinedload(models.User.role))
    )
    
    # FALLBACK: Email lookup for admin-provisioned users (DN=NULL initially)
    if not user:
        user = await session.scalar(
            select(models.User)
            .where(models.User.auth_method == "LDAP")
            .where(models.User.oauth2_user_id.is_(None))
            .where(func.lower(models.User.email) == email)
        )
        if user:
            user.oauth2_user_id = user_dn_canonical  # Upgrade to DN
            if user.ldap_dn is None:
                user.ldap_dn = user_dn_canonical
    
    # Create new user if not found
    if not user:
        role = await session.scalar(select(models.Role).where(models.Role.name == role_name))
        
        user = models.LDAPUser(  # NEW: Use LDAPUser class
            email=email,
            username=user_info.display_name,
            user_dn=user_dn_canonical,
            user_role_id=role.id if role else None,
        )
        session.add(user)
    
    return user
```

### Remove Helper Functions

```python
# These are no longer needed with polymorphism:

# REMOVE: is_ldap_user(user) helper
# REPLACE WITH: isinstance(user, models.LDAPUser)

# REMOVE: LDAP_CLIENT_ID_MARKER checks in business logic
# REPLACE WITH: Type-based polymorphism
```

---

## DN-Based vs Email-Based: Why DN Matters

### Problem with Email-Only Identification

**Scenario**: User's email changes in LDAP directory

```
Initial:  uid=john,dc=example,dc=com → john@old-domain.com
Later:    uid=john,dc=example,dc=com → john@new-domain.com
```

**Email-based system**:
- ❌ Creates duplicate account (email changed)
- ❌ User loses access to original account
- ❌ Admin must manually merge accounts

**DN-based system** (Phoenix's approach):
- ✅ Same DN = same user (email change detected)
- ✅ Phoenix updates email in database
- ✅ User maintains same account, projects, permissions

### Why Canonicalization Matters

**Scenario**: LDAP server changes DN formatting

```
Login 1: "UID=Alice,OU=Users,DC=Example,DC=Com"  → Canonical: "uid=alice,ou=users,dc=example,dc=com"
Login 2: "uid=alice, ou=users, dc=example, dc=com" → Canonical: "uid=alice,ou=users,dc=example,dc=com"
```

**Without canonicalization**:
- ❌ Creates duplicate accounts (different string)
- ❌ User confusion (multiple accounts)

**With canonicalization** (Phoenix's approach):
- ✅ Both logins → same canonical DN
- ✅ Single account maintained
- ✅ RFC 4514 compliant

---

## Email Fallback: Why It Exists

**Use Case**: Admin provisions LDAP users via `PHOENIX_ADMINS` at startup

```python
# Phoenix creates LDAP user before first login
user = models.LDAPUser(
    email="alice@example.com",
    username="Alice Smith",
    user_dn=None,  # DN unknown until first LDAP login
)
```

**First Login Flow**:
1. User authenticates via LDAP
2. Phoenix gets DN from LDAP server
3. DN lookup fails (`oauth2_user_id=NULL`)
4. **Email fallback** finds pre-provisioned user
5. Phoenix upgrades: `oauth2_user_id = canonical_dn`
6. Future logins use DN (faster, more reliable)

**Result**: Seamless admin provisioning without requiring DN knowledge upfront.

---

## Migration Validation

### Pre-Migration Checks

```sql
-- Count current LDAP users
SELECT COUNT(*) 
FROM users 
WHERE oauth2_client_id = E'\uE000LDAP';

-- Verify DN data exists
SELECT COUNT(*) 
FROM users 
WHERE oauth2_client_id = E'\uE000LDAP'
  AND oauth2_user_id IS NOT NULL;

-- Check for DN=NULL users (admin-provisioned)
SELECT email, username
FROM users 
WHERE oauth2_client_id = E'\uE000LDAP'
  AND oauth2_user_id IS NULL;
```

### Post-Migration Checks

```sql
-- Verify migration success
SELECT 
    COUNT(*) as total_ldap_users,
    COUNT(*) FILTER (WHERE ldap_dn IS NOT NULL) as with_dn,
    COUNT(*) FILTER (WHERE oauth2_user_id IS NOT NULL) as with_dn_in_oauth2
FROM users 
WHERE auth_method = 'LDAP';

-- Should show: all LDAP users have auth_method='LDAP'
-- Expected: total_ldap_users = with_dn (if ldap_dn column added)

-- Verify DN canonicalization preserved
SELECT oauth2_user_id, ldap_dn
FROM users
WHERE auth_method = 'LDAP'
  AND oauth2_user_id != ldap_dn
LIMIT 10;

-- Should return 0 rows (or only NULL cases)
```

### Integration Test

```python
async def test_ldap_migration():
    """Verify LDAP users work after migration."""
    
    # Test DN-based lookup
    user = await session.scalar(
        select(models.User)
        .where(models.User.auth_method == "LDAP")
        .where(models.User.oauth2_user_id == "uid=test,dc=example,dc=com")
    )
    assert user is not None
    assert isinstance(user, models.LDAPUser)
    
    # Test polymorphism
    ldap_users = (await session.scalars(
        select(models.LDAPUser)
    )).all()
    assert len(ldap_users) > 0
    
    # Test email fallback still works
    user = await session.scalar(
        select(models.User)
        .where(models.User.auth_method == "LDAP")
        .where(models.User.oauth2_user_id.is_(None))
        .where(func.lower(models.User.email) == "admin@example.com")
    )
    # Should find admin-provisioned users
```

---

## Rollback Strategy

### Immediate Rollback (During Migration Window)

```sql
-- Revert auth_method changes
UPDATE users 
SET auth_method = 'OAUTH2'
WHERE auth_method = 'LDAP';

-- Restore original constraints
ALTER TABLE users DROP CONSTRAINT users_auth_method_check;
ALTER TABLE users ADD CONSTRAINT users_auth_method_check
    CHECK (auth_method IN ('LOCAL', 'OAUTH2'));
```

### Emergency Rollback (If Issues Discovered Later)

```python
# Deploy code that accepts both formats
async def find_ldap_user_robust(session: AsyncSession, user_dn: str):
    """Find LDAP user supporting both Approach 1 and Approach 2."""
    canonical_dn = canonicalize_dn(user_dn)
    
    # Try Approach 2 (new format)
    user = await session.scalar(
        select(models.User)
        .where(models.User.auth_method == "LDAP")
        .where(models.User.oauth2_user_id == canonical_dn)
    )
    if user:
        return user
    
    # Fallback: Approach 1 (old format)
    user = await session.scalar(
        select(models.User)
        .where(models.User.auth_method == "OAUTH2")
        .where(models.User.oauth2_client_id == LDAP_CLIENT_ID_MARKER)
        .where(models.User.oauth2_user_id == canonical_dn)
    )
    return user
```

---

## Timeline & Effort

**Option A (Single Migration)**:
- **Planning**: 1-2 hours (review migration script)
- **Testing**: 2-4 hours (staging environment validation)
- **Execution**: 5-30 minutes (depends on user count)
- **Validation**: 1 hour (post-migration checks)
- **Total**: ~1 day

**Downtime**: 
- Small installations (<1K users): Negligible (<1 min)
- Large installations (>10K users): 5-30 minutes

**Risk**: Low (simple UPDATE, clear rollback path)

---

## When to Migrate

**Stay on Approach 1 if**:
- ✅ Current implementation working well
- ✅ Shipping speed > code consistency
- ✅ Not ready to coordinate migration across deployments

**Migrate to Approach 2 when ALL of**:
- ✅ Want clean schema (dedicated `ldap_dn` column, no OAuth2 pollution)
- ✅ Ready to coordinate migration (downtime acceptable)
- ✅ Willing to pay migration cost for architectural consistency

**Note**: Don't migrate just for polymorphism - Approach 1 works fine without it. Only migrate if you want the **full clean schema** and are ready to commit to Approach 2 completely.

---

## Summary

**Approach 1 → 2 migration delivers true clean schema**:
1. Update `auth_method` from `'OAUTH2'` to `'LDAP'`
2. Add dedicated `ldap_dn` column (required, stores canonicalized DN)
3. Clear OAuth2 columns (`oauth2_client_id`, `oauth2_user_id` → NULL)
4. Enable polymorphism (`LDAPUser` class)
5. DN remains primary identifier (no change to identification strategy)
6. Email fallback preserved (no change to admin provisioning)

**Key Point**: DN-based identification is **already implemented**. Migration just separates LDAP from OAuth2 schema.

**Binary Choice**: Either stay on Approach 1 (no migration) or do full Approach 2 (clean schema). No halfway options.

---

