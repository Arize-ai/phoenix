# Database Schema Details

## Current Implementation (Stopgap)

**Storage Format**:
```
users table:
  auth_method = 'OAUTH2'
  oauth2_client_id = '\ue000LDAP(stopgap)'  ← Identifies as LDAP user
  oauth2_user_id = '<unique_id>' or NULL    ← Immutable ID (if configured) or NULL (email-based)
  email = 'john@example.com'                ← User identifier (simple mode) or synced attribute
  username = 'John Doe'                     ← Display name (synced from LDAP)
```

**Marker Format**: `\ue000LDAP(stopgap)`
- `\ue000` = Unicode Private Use Area (U+E000-U+F8FF)
- `LDAP` = Human-readable identifier
- Simple constant value for all LDAP users

**Why This Is Collision-Free**:
1. **Unicode PUA Guarantee**: U+E000-U+F8FF reserved for private use, never assigned by Unicode Standard (30+ year guarantee)
2. **OAuth2 RFC 6749**: Restricts `client_id` to ASCII (0x20-0x7E), cannot contain Unicode
3. **Real-World Validation**: No OAuth2 provider uses Unicode characters in client IDs
4. **Active Defense**: `_validate_oauth2_client_id()` rejects PUA characters in configured OAuth2 client IDs

**User Identification**:

| Mode | `oauth2_user_id` | Lookup |
|------|------------------|--------|
| Simple (default) | `NULL` | By `email` column |
| Enterprise | objectGUID/entryUUID | By `oauth2_user_id`, fallback to `email` |

See [User Identification Strategy](./user-identification-strategy.md) for details.

**Implementation**:

```python
LDAP_CLIENT_ID_MARKER = "\ue000LDAP(stopgap)"  # Simple constant marker
```

**Helper Function**:
```python
LDAP_CLIENT_ID_MARKER = "\ue000LDAP(stopgap)"

def is_ldap_user(oauth2_client_id: Optional[str]) -> bool:
    """Check if user is authenticated via LDAP."""
    return oauth2_client_id == LDAP_CLIENT_ID_MARKER
```

**Database Queries**:
```sql
-- Find all LDAP users
SELECT * FROM users 
WHERE oauth2_client_id = E'\uE000LDAP(stopgap)';

-- Simple mode: Find LDAP user by email
SELECT * FROM users 
WHERE oauth2_client_id = E'\uE000LDAP(stopgap)'
  AND LOWER(email) = 'john@example.com';

-- Enterprise mode: Find LDAP user by unique_id
SELECT * FROM users 
WHERE oauth2_client_id = E'\uE000LDAP(stopgap)'
  AND oauth2_user_id = '550e8400-e29b-41d4-a716-446655440000';
```

---

## Future Migration (Dedicated Schema)

If/when we migrate to a dedicated LDAP schema, the changes would be:

**Schema Changes**:
```sql
-- Step 1: Allow 'LDAP' as auth_method
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth_method_check;
ALTER TABLE users ADD CONSTRAINT users_auth_method_check
    CHECK (auth_method IN ('LOCAL', 'OAUTH2', 'LDAP'));

-- Step 2: Migrate LDAP users
UPDATE users 
SET auth_method = 'LDAP'
WHERE oauth2_client_id = E'\uE000LDAP(stopgap)';
```

**Note**: We do NOT add a `ldap_dn` column. DN is not used for user identification
(DNs change too frequently). Users are identified by email or unique_id (objectGUID/entryUUID).

**Post-Migration Queries**:
```sql
-- Find all LDAP users (cleaner!)
SELECT * FROM users WHERE auth_method = 'LDAP';

-- Simple mode: Find LDAP user by email
SELECT * FROM users 
WHERE auth_method = 'LDAP'
  AND LOWER(email) = 'john@example.com';

-- Enterprise mode: Find LDAP user by unique_id
SELECT * FROM users 
WHERE auth_method = 'LDAP'
  AND oauth2_user_id = '550e8400-e29b-41d4-a716-446655440000';
```

**Key Point**: The migration only changes `auth_method` for semantic clarity. The identification
strategy (email or unique_id) remains unchanged.

See [Migration Plan](./migration-plan.md) for full details.
