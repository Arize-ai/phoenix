## ⚠️ Critical Design Decision: DN + Email for LDAP Users

**Phoenix stores DN in `oauth2_user_id` for stable identification, with email enforced unique by database constraint.**

### Dual Identifier Strategy

After LDAP authentication succeeds, Phoenix has **both DN and email**:

```python
user_info = await ldap_auth.authenticate(username, password)
# Returns: {"email": "john@example.com", "display_name": "John Smith", 
#           "user_dn": "uid=jdoe,ou=users,dc=example,dc=com", "role": "ADMIN"}

# Canonicalize DN per RFC 4514 (case, whitespace, RDN ordering)
user_dn_canonical = canonicalize_dn(user_info["user_dn"])

# PRIMARY: DN lookup (stable, survives email changes, RFC 4514 canonical)
user = await session.scalar(
    select(models.User)
    .where(models.User.oauth2_client_id == LDAP_CLIENT_ID_MARKER)
    .where(models.User.oauth2_user_id == user_dn_canonical)
)

# FALLBACK: Email lookup for admin-provisioned users (DN=NULL initially)
if not user:
    user = await session.scalar(
        select(models.User)
        .where(models.User.oauth2_client_id == LDAP_CLIENT_ID_MARKER)
        .where(models.User.oauth2_user_id.is_(None))
        .where(func.lower(models.User.email) == user_info["email"].lower())
    )
    if user:
        user.oauth2_user_id = user_dn_canonical  # Upgrade to canonical DN
```

**Why both?** DN is stable (survives email changes), email is enforced unique in database.

### Comparison: Grafana vs Phoenix

**Why Grafana Uses DN:**

Grafana stores LDAP users' Distinguished Names (DN) in a separate `user_auth` table with `auth_module='ldap'` and `auth_id=<DN>`. This design enables:

1. **Multi-auth per user**: Same Grafana user can log in via LDAP, OAuth2, Google, etc.
   ```sql
   -- Grafana schema
   user: id=123, email='john@example.com'
   user_auth: user_id=123, auth_module='ldap', auth_id='cn=john,ou=users,dc=example,dc=com'
   user_auth: user_id=123, auth_module='oauth2', auth_id='google-12345'
   ```

2. **Email independence**: User lookup by DN (primary) → fallback to email/username
   - Tolerates email changes in LDAP without re-provisioning
   - DN is immutable in LDAP directory structure

3. **True LDAP identifier tracking**: Stores canonical LDAP DN for reference

**Phoenix's Similar Choice (Approach 1 MVP):**

Phoenix now **stores DN in `oauth2_user_id`** to match Grafana's pattern and handle email changes:

| Identifier | Grafana | Phoenix (Approach 1) |
|------------|---------|----------------------|
| **Primary lookup** | DN (stored in `user_auth` table) | ✅ DN (stored in `oauth2_user_id`) |
| **Fallback lookup** | Email, then username | Email (for admin-provisioned users with NULL DN) |
| **Storage overhead** | Requires `user_auth` table | ✅ Reuses existing `oauth2_user_id` column |
| **Performance** | O(1) indexed DN lookup | ✅ O(1) indexed lookup |
| **Uniqueness** | DN guaranteed unique in LDAP | ✅ DN unique per LDAP directory |
| **Multi-auth support** | ✅ Same user via LDAP + OAuth2 | ❌ One auth method per user (intentional) |
| **Email changes** | ✅ Seamless (DN still works) | ✅ Seamless (DN lookup, email synced) |

**Result**: DN-based lookup provides email change resilience while reusing existing columns.

**Grafana's User Lookup Flow** (from `user_sync.go`):
```go
// 1. Try user_auth table lookup by DN
if identity.AuthID != "" {
    authInfo := GetAuthInfo(AuthID: dn, AuthModule: "ldap")
    user := GetByID(authInfo.UserId)  // ← DN lookup
    return user
}

// 2. Fallback: user table lookup by email/username
user := lookupByOneOf(email, username)
return user
```

**Phoenix's Equivalent Flow** (`auth.py`):
```python
# 1. Primary: DN lookup (stable identifier from LDAP)
user = session.scalar(
    select(User)
    .where(User.oauth2_client_id == LDAP_CLIENT_ID_MARKER)
    .where(User.oauth2_user_id == user_dn)
)

# 2. Fallback: Email lookup for admin-provisioned users (oauth2_user_id=NULL)
if not user:
    user = session.scalar(
        select(User)
        .where(User.oauth2_client_id == LDAP_CLIENT_ID_MARKER)
        .where(User.oauth2_user_id.is_(None))
        .where(func.lower(User.email) == email.lower())
    )
    # Upgrade to DN-based storage on first login
    if user:
        user.oauth2_user_id = user_dn
    .where(func.lower(User.email) == email.lower())
)
```

### Email Attribute Requirements

**LDAP Standards:**
- RFC 4524: Defines `mail` attribute (OID 0.9.2342.19200300.100.1.3)
- RFC 2798: `inetOrgPerson` object class includes `mail`
- **Not mandatory** but standard practice in corporate directories

**Real-World Coverage:**
- ✅ Active Directory: `mail` nearly universal (Microsoft 365/Exchange)
- ✅ OpenLDAP: `mail` standard in `inetOrgPerson`
- ✅ 389 Directory: `mail` in default schemas
- ⚠️ Edge case: Legacy/minimal LDAP setups may lack email

**Phoenix validation** (`src/phoenix/server/ldap.py`):
```python
email = self._get_attribute(user_entry, self.config.attr_email)

if not email:
    logger.error(f"LDAP user {username} missing email attribute")
    return None  # Returns None → auth.py returns 401 (not 500)
```

**Error handling** (`src/phoenix/server/api/routers/auth.py`):
```python
if not user_info:
    # Generic 401 error (prevents username enumeration)
    raise HTTPException(status_code=401, detail="Invalid username and/or password")
```

**Integration test** (`tests/integration/auth/test_ldap.py`):
```python
def test_ldap_missing_email_attribute():
    """Test Phoenix's handling when LDAP user has no email attribute."""
    _ldap_server.add_user(username="no_email", email="", ...)  # Empty email
    
    response = client.post("/auth/ldap/login", ...)
    
    assert response.status_code == 401  # ✅ Graceful rejection, not 500
    assert "Invalid username and/or password" in response.text
```

### Critical Caveats

#### 1. **Email Attribute Must Exist**

**Symptom**: Login fails with "Invalid username and/or password"  
**Cause**: LDAP entry missing configured email attribute

**Resolution**:
```bash
# Option A: Populate 'mail' attribute in LDAP
# Option B: Use alternative attribute
PHOENIX_LDAP_ATTR_EMAIL="userPrincipalName"  # AD without Exchange

# Option C: Use DN as email (last resort)
PHOENIX_LDAP_ATTR_EMAIL="distinguishedName"  # Not recommended
```

#### 2. **Email Changes = New Account**

**Scenario**: User's email changes in LDAP `john@old.com` → `john@new.com`

**Impact**:
- `allow_sign_up=true`: Creates duplicate account with new email
- `allow_sign_up=false`: Login fails (user not found by new email)

**Mitigation**: Organizational policy to keep emails immutable, or manual admin intervention.

**Grafana comparison**: Uses DN for lookup (immune to email changes), but Phoenix accepts this tradeoff for simplicity.

#### 3. **Multiple LDAP Forests with Duplicate Emails**

**Scenario**: Merged organizations with overlapping emails

**Phoenix behavior**: First user gets the email, second user rejected (email collision)

**Mitigation**: Use separate Phoenix instances per LDAP forest

→ *Full analysis*: [User Identification Strategy](./ldap-authentication/user-identification-strategy.md)

---

