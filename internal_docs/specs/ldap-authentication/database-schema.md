# Database Schema Details

#### Option 1: Zero-Migration Storage

**Storage Format**:
```
users table:
  auth_method = 'OAUTH2'
  oauth2_client_id = '\ue000LDAP(stopgap)'  ← Identifies as LDAP
  oauth2_user_id = 'uid=jdoe,ou=users,dc=example,dc=com'  ← Stable LDAP DN
  email = 'john@example.com'       ← Synced from LDAP (can change!)
  username = 'John Doe'            ← Display name (synced from LDAP)
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

**Detailed Analysis**: See [Appendix G: Collision Prevention Analysis](#appendix-g-collision-prevention-analysis)

**Implementation**:

```python
LDAP_CLIENT_ID_MARKER = "\ue000LDAP(stopgap)"  # Simple constant marker
```

**Helper Function**:
```python
LDAP_CLIENT_ID_MARKER = "\ue000LDAP(stopgap)"

def is_ldap_user(user: models.User) -> bool:
    """Check if user is authenticated via LDAP."""
    return (
        user.auth_method == "OAUTH2" and 
        user.oauth2_client_id == LDAP_CLIENT_ID_MARKER
    )

def get_ldap_user_dn(user: models.User) -> Optional[str]:
    """Get DN for LDAP user (primary stable identifier)."""
    if not is_ldap_user(user):
        return None
    return user.oauth2_user_id  # DN stored here (RFC 4514 canonical)
```

**Database Queries**:
```sql
-- Find all LDAP users
SELECT * FROM users 
WHERE auth_method='OAUTH2' 
  AND oauth2_client_id = E'\uE000LDAP';

-- Find specific LDAP user by DN (primary lookup, RFC 4514 canonical)
SELECT * FROM users 
WHERE oauth2_client_id = E'\uE000LDAP'
  AND oauth2_user_id = 'uid=jdoe,ou=users,dc=example,dc=com';

-- Find LDAP user by email (fallback for admin-provisioned users)
SELECT * FROM users 
WHERE oauth2_client_id = E'\uE000LDAP'
  AND oauth2_user_id IS NULL
  AND LOWER(email) = 'john@example.com';
```

---

#### Option 2: Dedicated Columns (With Migration)

**Column Design**:

Only 1 column needed for LDAP authentication:

| Column | Purpose |
|--------|---------|
| `ldap_dn` | The LDAP Distinguished Name (e.g., `"uid=jdoe,ou=users,dc=example,dc=com"`). Stable identifier, RFC 4514 canonicalized. |

**Migration Script**:
```sql
-- Step 1: Add dedicated LDAP column
ALTER TABLE users ADD COLUMN ldap_dn VARCHAR;

-- Step 2: Update auth_method enum constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth_method_check;
ALTER TABLE users ADD CONSTRAINT users_auth_method_check
    CHECK (auth_method IN ('LOCAL', 'OAUTH2', 'LDAP'));

-- Step 3: Drop and recreate password constraints to account for LDAP
-- Old constraint: "LOCAL must have password, non-LOCAL must not"
-- New constraint: "LOCAL must have password, LDAP/OAUTH2 must not"
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth_method_check1;
ALTER TABLE users ADD CONSTRAINT users_auth_method_check1 CHECK (
    (auth_method = 'LOCAL' AND password_hash IS NOT NULL AND password_salt IS NOT NULL 
     AND oauth2_client_id IS NULL AND oauth2_user_id IS NULL AND ldap_dn IS NULL)
    OR (auth_method = 'OAUTH2' AND password_hash IS NULL AND password_salt IS NULL 
     AND oauth2_client_id IS NOT NULL AND oauth2_user_id IS NOT NULL AND ldap_dn IS NULL)
    OR (auth_method = 'LDAP' AND password_hash IS NULL AND password_salt IS NULL 
     AND oauth2_client_id IS NULL AND oauth2_user_id IS NULL AND ldap_dn IS NOT NULL)
);
```

**SQLAlchemy Model**:
```python
# Update AuthMethod type alias
AuthMethod: TypeAlias = Literal["LOCAL", "OAUTH2", "LDAP"]

# Add polymorphic LDAPUser class
class LDAPUser(User):
    """LDAP-authenticated user with DN-based identification."""
    
    __mapper_args__ = {
        "polymorphic_identity": "LDAP",
    }
    
    def __init__(
        self,
        *,
        email: str,
        username: str,
        user_dn: str,  # RFC 4514 canonicalized DN
        user_role_id: Optional[int] = None,
    ) -> None:
        from phoenix.server.ldap import canonicalize_dn
        
        if not user_dn:
            raise ValueError("user_dn required for LDAPUser")
        
        canonical_dn = canonicalize_dn(user_dn)
        
        super().__init__(
            email=email.strip(),
            username=username.strip(),
            user_role_id=user_role_id,
            reset_password=False,
            auth_method="LDAP",
            ldap_dn=canonical_dn,  # RFC 4514 canonicalized DN
            oauth2_client_id=None,  # Clear OAuth2 columns
            oauth2_user_id=None,     # (complete separation)
        )
```

**Usage**:
```python
# Create LDAP user with type safety
ldap_user = LDAPUser(
    email="jdoe@example.com",
    username="John Doe",
    user_dn="uid=jdoe,ou=users,dc=example,dc=com",  # Full DN, will be canonicalized
    user_role_id=admin_role_id,
)

# Type checking works
assert isinstance(ldap_user, LDAPUser)  # True
assert ldap_user.auth_method == "LDAP"  # True
assert ldap_user.ldap_dn == "uid=jdoe,ou=users,dc=example,dc=com"  # Canonical form

# Query for LDAP users only
ldap_users = session.query(LDAPUser).all()  # Type: list[LDAPUser]
```

**Database Queries**:
```sql
-- Find all LDAP users (simple!)
SELECT * FROM users WHERE auth_method='LDAP';

-- Find specific LDAP user by DN (primary identifier, RFC 4514 canonical)
SELECT * FROM users 
WHERE auth_method='LDAP' 
  AND ldap_dn='uid=jdoe,ou=users,dc=example,dc=com';
```

**Key Design**: Option 2 completely separates LDAP from OAuth2 schema. OAuth2 columns (`oauth2_client_id`, `oauth2_user_id`) are NULL for LDAP users. This delivers Approach 2's promise of "clean schema, no technical debt."

---

