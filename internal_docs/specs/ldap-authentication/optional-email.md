# Optional Email for LDAP Users

## Problem Statement

Some LDAP directories do not populate the `mail` attribute for users. Currently, Phoenix requires email for all users due to a database constraint (`email VARCHAR NOT NULL`). This prevents organizations without email in their LDAP from using Phoenix's LDAP authentication.

**User request:** Support LDAP authentication when `PHOENIX_LDAP_ATTR_EMAIL` is empty or the attribute doesn't exist.

## Constraints

1. **Database schema cannot change immediately** - `email` column is `NOT NULL` with a unique index
2. **Email is used throughout the codebase** - UI display, welcome emails, password reset, admin checks
3. **Must maintain user lookup integrity** - Need stable identifier for returning users

## Solution Overview

### Two-Phase Approach

| Phase | Solution | Timeline |
|-------|----------|----------|
| **Phase 1 (Bridge)** | Placeholder email with PUA marker | Now |
| **Phase 2 (Final)** | Make `email` column nullable | Future |

The bridge solution allows immediate support for email-less LDAP while the eventual solution provides a cleaner long-term approach.

---

## Phase 1: Bridge Solution (Placeholder)

### Design

When `PHOENIX_LDAP_ATTR_EMAIL` is empty, Phoenix generates a **placeholder** to satisfy the `NOT NULL` constraint:

```python
from hashlib import md5

NULL_EMAIL_MARKER_PREFIX = "\uE000NULL"  # PUA character + "NULL" indicator

def generate_null_email_marker(unique_id: str) -> str:
    """Generate a deterministic placeholder from unique_id.
    
    Using MD5 hash ensures:
    - Same unique_id always produces the same placeholder
    - No race conditions on concurrent logins
    - Placeholder is stable across restarts
    
    Note: MD5 is fine here - we're not using it for security, 
    just for deterministic uniqueness.
    """
    normalized = unique_id.lower()  # Case-insensitive (UUIDs are case-insensitive)
    return f"{NULL_EMAIL_MARKER_PREFIX}{md5(normalized.encode()).hexdigest()}"
    # Example: unique_id "550E8400-E29B-41D4-A716-446655440000"
    #       → "\uE000NULL7f3d2a1b9c8e4f5da2b6c903e1f47d8b"

def is_null_email_marker(email: str) -> bool:
    """Check if email is a placeholder."""
    return email.startswith(NULL_EMAIL_MARKER_PREFIX)
```

### Why This Format?

| Component | Purpose |
|-----------|---------|
| `\uE000` (PUA) | Invisible marker for programmatic detection |
| `NULL` | Human-readable indicator that email is absent |
| `md5(unique_id)` | Deterministic hash (32 hex chars) for uniqueness |

### Why Hash Instead of Random?

| Approach | Pros | Cons |
|----------|------|------|
| `token_hex(8)` | Simple | Different placeholder on each login attempt |
| `md5(unique_id)` | **Deterministic**, no race conditions | Requires unique_id (already required) |

Using a hash means:
- **Idempotent creation** - Concurrent logins for the same user produce the same placeholder
- **Stable lookups** - Can look up by placeholder email if needed (edge cases)
- **No accidental duplicates** - Same unique_id always maps to same placeholder

### Configuration

```bash
# LDAP with email (default)
PHOENIX_LDAP_ATTR_EMAIL=mail

# LDAP without email - generates placeholder
PHOENIX_LDAP_ATTR_EMAIL=
PHOENIX_LDAP_ATTR_UNIQUE_ID=objectGUID  # Required when email is empty
```

**Validation rule:** `PHOENIX_LDAP_ATTR_UNIQUE_ID` is **required** when `PHOENIX_LDAP_ATTR_EMAIL` is empty.

### Why Require Unique ID?

The `unique_id` serves two purposes:

1. **User lookup** - Primary identifier for returning users
2. **Placeholder generation** - Hash input for deterministic placeholder email

```python
# unique_id is used for both:
user = await _lookup_by_unique_id(session, unique_id)  # Lookup
placeholder = generate_null_email_marker(unique_id)  # Generation
```

Without `unique_id`, we have nothing to hash and no way to identify returning users.

### Implementation Changes

#### 1. Configuration (`src/phoenix/config.py`)

```python
# Allow empty attr_email
attr_email_raw = getenv(ENV_PHOENIX_LDAP_ATTR_EMAIL, "mail")
attr_email = attr_email_raw if attr_email_raw else None

# Validations when email is empty (placeholder mode)
if not attr_email:
    if not attr_unique_id:
        raise ValueError(
            "PHOENIX_LDAP_ATTR_UNIQUE_ID is required when PHOENIX_LDAP_ATTR_EMAIL is empty. "
            "Without email, unique_id is needed to identify returning users."
        )
    if not allow_sign_up:
        raise ValueError(
            "PHOENIX_LDAP_ALLOW_SIGN_UP must be True when PHOENIX_LDAP_ATTR_EMAIL is empty. "
            "Placeholder emails require auto-provisioning on first login."
        )
    if get_env_admins():
        raise ValueError(
            "PHOENIX_ADMINS is not supported when PHOENIX_LDAP_ATTR_EMAIL is empty. "
            "Users are auto-provisioned on first login with roles from LDAP group mapping."
        )
```

#### 2. LDAPUserInfo (`src/phoenix/server/ldap.py`)

```python
class LDAPUserInfo(NamedTuple):
    email: str | None  # None if PHOENIX_LDAP_ATTR_EMAIL is empty
    display_name: str
    groups: list[str]
    user_dn: str
    ldap_username: str
    role: str
    unique_id: str | None = None
```

#### 3. Authentication (`src/phoenix/server/ldap.py`)

```python
# In _authenticate()
if self.config.attr_email:
    email = _get_attribute(user_entry, self.config.attr_email)
    if not email:
        # Fail loudly if attribute configured but missing
        raise LDAPConfigurationError(
            f"LDAP user '{username}' is missing required attribute "
            f"'{self.config.attr_email}'. Either populate this attribute "
            f"or set PHOENIX_LDAP_ATTR_EMAIL= (empty) to use placeholders."
        )
else:
    email = None  # Will generate placeholder in get_or_create_ldap_user

return LDAPUserInfo(email=email, ...)
```

#### 4. User Creation (`src/phoenix/server/api/routers/ldap.py`)

```python
async def get_or_create_ldap_user(
    session: AsyncSession,
    user_info: LDAPUserInfo,
    ldap_config: LDAPConfig,
) -> models.User:
    unique_id = user_info.unique_id  # Required when email is None
    
    # Real email or None
    email = sanitize_email(user_info.email) if user_info.email else None
    
    # Step 1: Lookup by unique_id first (always, when configured)
    user = None
    if unique_id:
        user = await _lookup_by_unique_id(session, unique_id)
    
    # Step 2: Fallback to email lookup (only for real emails)
    if not user and email:
        user = await _lookup_by_email(session, email)
        if user:
            # Migration logic for unique_id (existing code)
            ...
    
    # Step 3: Return existing user (update email if changed)
    if user:
        if email and user.email != email:
            user.email = email  # Sync email (works for both null marker → real and real → real)
        return user
    
    # Step 4: Create new user
    if not ldap_config.allow_sign_up:
        raise HTTPException(401, "Invalid username and/or password")
    
    # Use real email or generate deterministic placeholder
    db_email = email if email else generate_null_email_marker(unique_id)
    
    user = models.User(
        email=db_email,
        username=...,
        oauth2_client_id=LDAP_CLIENT_ID_MARKER,
        oauth2_user_id=unique_id,
        ...
    )
    session.add(user)
    return user
```

#### 5. Email Sending (`src/phoenix/server/email/sender.py`)

Email sending naturally handles null email markers without explicit checks. The `email_validator` library validates email format before sending, and null email markers (which have no `@` symbol) fail validation:

```python
async def send_welcome_email(self, email: str, name: str) -> None:
    try:
        email = validate_email(email, check_deliverability=False).normalized
    except EmailNotValidError:
        logger.warning("Skipping welcome email for user with invalid email address")
        return
    # ... existing logic ...

async def send_password_reset_email(self, email: str, reset_url: str) -> None:
    try:
        email = validate_email(email, check_deliverability=False).normalized
    except EmailNotValidError:
        logger.warning("Skipping password reset email for user with invalid email address")
        return
    # ... existing logic ...
```

This approach is preferred over explicit `is_null_email_marker()` checks because:
- It handles all invalid emails, not just null markers
- Email validation is already required before sending
- No additional imports or coupling to LDAP-specific code

#### 6. Frontend

**Server injects config into window object (`app/src/pages/Layout.tsx` or similar):**

```tsx
// Injected by server into the HTML template
declare global {
  interface Window {
    Config: {
      // Placeholder email detection
      nullEmailMarkerPrefix: string;   // "\uE000NULL" - prefix for placeholder emails
      ldapManualUserCreationEnabled: boolean;  // false when PHOENIX_LDAP_ATTR_EMAIL is empty
      // ... other config
    };
  }
}
```

**Helper functions (`app/src/utils/email.ts`):**

```typescript
export function isNullEmailMarker(email: string): boolean {
  return email.startsWith(window.Config.nullEmailMarkerPrefix);
}

export function getDisplayEmail(email: string): string | null {
  return isNullEmailMarker(email) ? null : email;
}
```

#### 7. UI Components

**Full survey of email usage in frontend:**

| File | Current Usage | Change Needed |
|------|---------------|---------------|
| `UsersCard.tsx` | "Add User" button | Disable when no user creation method is available |
| `UsersTable.tsx` | Displays email as mailto link | Hide for placeholder emails |
| `ViewerProfileCard.tsx` | Shows email in profile card | Hide for placeholder emails |
| `LDAPUserForm.tsx` | Email input for creating LDAP users | No change (only rendered when `ldapManualUserCreationEnabled=true`) |
| `NewUserDialog.tsx` | Creates users with email | Hide LDAP option when `ldapManualUserCreationEnabled=false` |
| `UserForm.tsx` | Email input for local users | No change (local users have real email) |
| `OAuthUserForm.tsx` | Email input for OAuth users | No change (OAuth users have real email) |
| `LoginForm.tsx` | Email for local auth login | No change (placeholder rejected server-side) |
| `ForgotPasswordForm.tsx` | Email for password reset | No change (LDAP users don't use password reset) |

**UsersCard.tsx:**
```tsx
// Disable "Add User" button only when no user creation method is available:
// - Basic auth disabled (can't create password users) AND
// - LDAP not enabled AND
// - Manual LDAP user creation not enabled
const isDisabled = useMemo(() => {
  // Disable when no user creation method is available:
  // - Basic auth is disabled AND
  // - No OAuth2 IDPs configured AND
  // - LDAP manual user creation is disabled
  return (
    window.Config.basicAuthDisabled &&
    !window.Config.oAuth2Idps.length &&
    !window.Config.ldapManualUserCreationEnabled
  );
}, []);

// Button is ENABLED when ANY of:
// - Basic auth is enabled (can create users with passwords)
// - LDAP is enabled
// - Manual LDAP user creation is enabled
```

**UsersTable.tsx:**
```tsx
import { isNullEmailMarker } from "@phoenix/utils/email";

// In the cell renderer - hide placeholder emails
{!isNullEmailMarker(row.original.email) && (
  <a href={`mailto:${row.original.email}`}>
    {row.original.email}
  </a>
)}
```

**ViewerProfileCard.tsx:**
```tsx
import { isNullEmailMarker } from "@phoenix/utils/email";

// Hide email field for users with placeholder
{!isNullEmailMarker(viewer.email) && (
  <TextField value={viewer.email} isReadOnly size="S">
    <Label>Email</Label>
    <Input />
  </TextField>
)}
```

**NewUserDialog.tsx:**
```tsx
// Hide "LDAP" auth method option when manual LDAP user creation is disabled
// (because we can't know the email or unique_id ahead of time)
{window.Config.ldapManualUserCreationEnabled && (
  <Item key="LDAP">LDAP</Item>
)}
```

**LDAPUserForm.tsx:**

No changes needed to this component. The form is only rendered when `ldapManualUserCreationEnabled=true` (controlled by `NewUserDialog.tsx`). The parent component's conditional rendering is sufficient protection.

### Behavior Summary

| Scenario | `ATTR_EMAIL` | `ATTR_UNIQUE_ID` | Email in DB | Lookup Strategy |
|----------|--------------|------------------|-------------|-----------------|
| Standard LDAP | `mail` | *(optional)* | Real email | By unique_id → by email |
| Enterprise LDAP | `mail` | `objectGUID` | Real email | By unique_id → by email |
| No-email LDAP | *(empty)* | `objectGUID` | Placeholder | By unique_id only |

### Edge Cases and Considerations

#### 1. Case Normalization of Unique ID

UUIDs can arrive in different cases. **Normalize to lowercase before hashing** to ensure consistent placeholders:

```python
def generate_null_email_marker(unique_id: str) -> str:
    normalized = unique_id.lower()  # Normalize case
    return f"{NULL_EMAIL_MARKER_PREFIX}{md5(normalized.encode()).hexdigest()}"
```

#### 2. Configuration Changes Mid-Flight

| Scenario | Behavior |
|----------|----------|
| Start with `ATTR_EMAIL=mail`, switch to `ATTR_EMAIL=` | Existing users keep real email. New users get placeholder. |
| Start with `ATTR_EMAIL=`, switch to `ATTR_EMAIL=mail` | On next login, **update placeholder → real email** |
| User has placeholder, LDAP now has email | Update to real email (placeholder → real is always allowed) |

**Code handles this naturally:**

```python
if user:
    if email and user.email != email:
        user.email = email  # Works for both: null marker → real, and real → real
    return user
```

No explicit `is_null_email_marker()` check needed—a null marker string is never equal to a real email string, so `user.email != email` handles both upgrade and sync cases.

#### 3. Admin Pre-Provisioning (`PHOENIX_ADMINS`)

**Current flow (with real emails):**
1. Admin sets `PHOENIX_ADMINS=alice=alice@corp.com`
2. Facilitator creates `LDAPUser(email="alice@corp.com", username="alice", unique_id=None)`
3. On first login: lookup by unique_id (not found) → fallback to email → match! → populate unique_id

**Problem with placeholder emails:**
- Admin can't provide real email (LDAP doesn't have it)
- Admin can't generate placeholder (doesn't know `unique_id` ahead of time)
- Pre-provisioning by email is impossible

**Options:**

| Option | Approach | Complexity | Trade-off |
|--------|----------|------------|-----------|
| **A. Disallow** | Fail startup if `PHOENIX_ADMINS` + placeholder mode | Low | Users get roles from LDAP group mapping on first login |
| **B. Username matching** | Pre-provision by username, match on first login | Medium | Username collision risk |
| **C. Unique ID format** | `PHOENIX_ADMINS=username=unique_id` in placeholder mode | Medium | Requires admin to query LDAP first |

**Phase 1 Recommendation: Option A (Disallow)**

```python
# In config validation
if not attr_email:  # Placeholder mode
    if get_env_admins():
        raise ValueError(
            "PHOENIX_ADMINS is not supported when PHOENIX_LDAP_ATTR_EMAIL is empty. "
            "Users are auto-provisioned on first login with roles from LDAP group mapping."
        )
```

**Rationale:**
- Simplest and safest for initial implementation
- Auto-provisioning (`allow_sign_up=True`) is already required in placeholder mode
- LDAP role mapping assigns roles automatically (including ADMIN) based on group membership

#### 4. `ALLOW_SIGN_UP=False` is Disallowed (Phase 1)

When `PHOENIX_LDAP_ATTR_EMAIL` is empty (placeholder mode), `PHOENIX_LDAP_ALLOW_SIGN_UP=False` is **not allowed** in Phase 1. This is enforced at startup:

```python
def validate_ldap_config():
    if not PHOENIX_LDAP_ATTR_EMAIL and not ldap_config.allow_sign_up:
        raise LDAPConfigurationError(
            "PHOENIX_LDAP_ALLOW_SIGN_UP must be True when PHOENIX_LDAP_ATTR_EMAIL is empty. "
            "Placeholder emails require auto-provisioning on first login."
        )
```

**Rationale:**
- Placeholder emails are generated from `unique_id` on first login
- Pre-provisioning users without knowing their `unique_id` is impractical
- Auto-provisioning is the natural flow for LDAP authentication

##### Future: Supporting `ALLOW_SIGN_UP=False`

Some organizations require explicit user provisioning (no auto-signup). Here are approaches to support this in the future:

> **Note:** This section is about **pre-provisioning general users** who should have Phoenix access. For **admin role assignment** in no-email mode, use `PHOENIX_LDAP_GROUP_ROLE_MAPPINGS` instead of `PHOENIX_ADMINS`. Group role mappings assign roles (including ADMIN) based on LDAP group membership at login time.

**Option 1: Unique ID-Based Pre-Provisioning**

**Concept:** Admin queries LDAP for user's `unique_id`, pre-provisions with computed placeholder.

```bash
# New format when placeholder mode
PHOENIX_ADMINS=alice:550E8400-E29B-41D4-A716-446655440000;bob:7C9E6679-7425-40DE-944B-E07FC1F90AE7
#             ^username:unique_id
```

**Implementation:**
```python
def parse_admins_placeholder_mode(env_value: str) -> dict[str, str]:
    """Parse username:unique_id pairs, return {placeholder_email: username}."""
    result = {}
    for pair in env_value.split(";"):
        username, unique_id = pair.strip().split(":")
        placeholder = generate_null_email_marker(unique_id)
        result[placeholder] = username
    return result
```

**First login flow:**
1. User authenticates via LDAP
2. Lookup by unique_id → finds pre-provisioned user (matched by placeholder email derived from same unique_id)
3. Login succeeds

**Pros:**
- Deterministic - same unique_id always produces same placeholder
- No username collision risk
- Admin has full control over who can access

**Cons:**
- Admin must query LDAP to get unique_ids (extra step)
- unique_id format varies (GUID vs UUID vs string)

**Admin workflow:**
```bash
# Query LDAP for user's objectGUID
ldapsearch -H ldap://dc.corp.com -b "dc=corp,dc=com" "(sAMAccountName=alice)" objectGUID

# Set env var with result
PHOENIX_ADMINS=alice:550e8400-e29b-41d4-a716-446655440000
```

**Option 2: Username-Based Matching with Collision Prevention**

**Concept:** Pre-provision by username only, match on first login by username.

```bash
# Username-only format
PHOENIX_ADMINS=alice;bob;charlie
```

**Implementation:**
```python
def pre_provision_ldap_user_by_username(username: str) -> models.User:
    """Create LDAP user with temporary placeholder, no unique_id."""
    temp_placeholder = f"{NULL_EMAIL_MARKER_PREFIX}PREPROV_{md5(username.lower().encode()).hexdigest()}"
    return models.LDAPUser(
        email=temp_placeholder,
        username=username,
        unique_id=None,  # Will be populated on first login
    )
```

**First login flow:**
1. User authenticates via LDAP (username=alice, unique_id=UUID-A)
2. Lookup by unique_id → not found
3. Lookup by email (placeholder from unique_id) → not found
4. **New:** Lookup by username among LDAP users with no unique_id → found!
5. Validate: user is LDAP user AND has no unique_id (pre-provisioned)
6. Update: set unique_id, replace temp placeholder with real placeholder
7. Login succeeds

```python
# In get_or_create_ldap_user
if not user and not ldap_config.allow_sign_up:
    # Try username match for pre-provisioned users
    user = await session.scalar(
        select(models.User)
        .where(models.User.username == user_info.display_name)
        .where(models.User.oauth2_client_id == LDAP_CLIENT_ID_MARKER)
        .where(models.User.oauth2_user_id.is_(None))  # No unique_id = pre-provisioned
    )
    if user:
        # Claim this pre-provisioned user
        user.oauth2_user_id = unique_id
        user.email = generate_null_email_marker(unique_id)
```

**Pros:**
- Simple admin workflow (just usernames)
- No need to query LDAP for unique_ids

**Cons:**
- Username collision risk if displayName differs from sAMAccountName
- Race condition if two users with same username try first login simultaneously
- Security: username-based matching is weaker than unique_id matching

**Mitigations:**
- Only match pre-provisioned users (oauth2_user_id IS NULL)
- Log warning if username match occurs
- Consider requiring exact username match (case-sensitive)

**Option 3: Admin API with LDAP Lookup**

**Concept:** Admin API that queries LDAP directly to provision users.

```
POST /api/v1/admin/ldap/provision
{
  "username": "alice",
  "role": "ADMIN"
}
```

**Server-side flow:**
1. API authenticates as service account to LDAP
2. Queries LDAP for user by username
3. Gets unique_id from LDAP response
4. Creates user with computed placeholder email
5. Returns created user

**Pros:**
- Best UX for admins (just provide username)
- Server handles LDAP lookup (no manual unique_id copying)
- Full validation (user must exist in LDAP)

**Cons:**
- Requires LDAP service account with read permissions
- More complex API implementation
- Network dependency on LDAP at provisioning time

**Comparison Matrix**

| Aspect | Option 1: Unique ID | Option 2: Username | Option 3: Admin API |
|--------|---------------------|--------------------|--------------------|
| Admin effort | High (query LDAP) | Low (just usernames) | Low (API call) |
| Implementation | Low | Medium | High |
| Security | High | Medium | High |
| LDAP dependency | At admin time | None | At provision time |
| Collision risk | None | Username collision | None |
| Phase 1 compatible | Yes | Yes | No (needs new API) |

**Recommendation for Future**

**Short-term (if needed soon):** Option 1 (Unique ID-based)
- Can be added to existing `PHOENIX_ADMINS` parsing
- No new APIs needed
- Highest security

**Long-term:** Option 3 (Admin API)
- Best admin experience
- Full validation against LDAP
- Can be combined with a "Provision from LDAP" UI button

#### 5. Search and Filtering

- Searching users by email will **not find** users with placeholders
- This is acceptable - placeholder emails are not meaningful
- Consider adding a filter for "users without email" in the UI

#### 6. Export/Import

If users are exported (e.g., to CSV):
- Placeholder emails will appear as `\uE000NULL...` (may render as `�NULL...`)
- On import, these would be treated as regular strings
- **Recommendation:** Use `get_display_email()` which returns `null` for placeholder, export as empty

#### 7. MD5 Collision Risk

- MD5 produces 128-bit hashes
- For UUIDs (also 128-bit), collision probability is ~1 in 2^64 for birthday attack
- With thousands of users, collision is astronomically unlikely
- If it somehow occurs, the unique constraint on email would catch it at insert time

#### 8. Audit Logs

- Don't log placeholder emails (they're noise)
- Log `username` and `unique_id` instead for LDAP users

### Security Considerations

#### 1. Unique ID is Mandatory

Placeholder emails require `unique_id` for deterministic generation and user lookup. This is enforced at startup.

#### 2. PUA Character Safety

- `\uE000` is a valid Unicode character, safe in PostgreSQL UTF-8
- Cannot collide with real email addresses (no valid email starts with PUA)
- May be stripped by some external systems (logs, exports) - use helper functions

#### 3. No Email Operations

Users with placeholder emails cannot:
- Receive welcome emails
- Use password reset (LDAP users don't need it anyway)
- Be contacted via email

#### 4. Login and API Endpoints Naturally Reject Null Email Markers

**Risk:** User attempts to log in or create account using a null email marker.

**Mitigation:** No explicit check needed. The standard email validation regex (`EMAIL_PATTERN`) requires an `@` symbol:

```python
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+[.][^@\s]+\Z")
```

Null email markers (`\uE000NULLabc123...`) have no `@` symbol, so they're automatically rejected by existing email format validation. This applies to:
- Local login endpoint (email/password auth)
- REST API user creation (`POST /v1/users`)
- GraphQL user creation (`createUser` mutation)

LDAP users authenticate via LDAP bind, not email/password, so the local login rejection is just defense-in-depth.

#### 5. MD5 Hash Does Not Reveal Unique ID

- MD5 is a one-way hash - cannot reverse to get unique_id
- However, if attacker **knows** a user's unique_id (e.g., from LDAP access), they can compute the expected placeholder email and confirm user exists in Phoenix
- **Risk level:** Low - unique_ids are not typically secret, and this only confirms existence

#### 6. Malicious LDAP Email Injection

**Risk:** LDAP admin sets a user's email to start with `\uE000` to make it appear placeholder.

**Impact:** 
- User's email would be hidden in UI (treated as placeholder)
- User couldn't receive Phoenix emails

**Risk level:** Low - requires LDAP admin access, impact is limited to UX

#### 7. PUA Stripping Attack

**Risk:** If a system strips PUA characters during export/import:
- `\uE000NULL7f3d...` becomes `NULL7f3d...`
- This could be imported as a "real" email

**Mitigation:**
- Export should use `get_display_email()` which returns `null` for placeholder
- Import should validate email format (reject strings starting with "NULL" + hex)

#### 8. API User Creation Security

**Risk:** Admin creates LDAP user via API without knowing unique_id.

**Scenarios:**
1. Admin provides real email → stored as-is
2. Admin provides no email → must fail or use temporary placeholder

**Recommendation:** For API-created LDAP users without email:
- Option A: Require email (admin must know it)
- Option B: Generate temporary random placeholder, replace on first LDAP login
- Option C: Require unique_id at creation time

Current recommendation: **Option A** - simplest, avoids complexity of temporary placeholders.

#### 9. Multi-LDAP Server Collision (Future)

**Risk:** If Phoenix supports multiple LDAP servers, same unique_id from different servers produces same placeholder email.

**Mitigation (future):** Include server identifier in hash:

```python
def generate_null_email_marker(unique_id: str, server_id: str) -> str:
    normalized = f"{server_id}:{unique_id}".lower()
    return f"{NULL_EMAIL_MARKER_PREFIX}{md5(normalized.encode()).hexdigest()}"
```

#### 10. Timing Attack on User Existence

**Risk:** Attacker probes whether users exist by measuring response time differences.

**Analysis:** 
- Placeholder email check is `O(1)` string prefix comparison
- Same code path regardless of placeholder vs real
- No additional timing leak introduced

**Risk level:** None (no new attack surface)

---

## Phase 2: Eventual Solution (Nullable Email)

### Database Migration

```sql
-- Step 1: Allow NULL
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Step 2: Partial unique index (NULLs are allowed, non-NULLs must be unique)
DROP INDEX ix_users_email;
CREATE UNIQUE INDEX ix_users_email ON users (email) WHERE email IS NOT NULL;

-- Step 3: Migrate placeholders to NULL
UPDATE users SET email = NULL WHERE email LIKE E'\uE000%';
```

### Code Changes

1. **Model:** `email: Mapped[Optional[str]]`
2. **GraphQL:** `email: Optional[str]`
3. **REST API:** `email: Optional[str] = None`
4. **Frontend:** Handle `null` instead of checking for PUA marker
5. **Remove:** `is_null_email_marker()` helper (no longer needed)

### Effort Estimate

| Task | Effort |
|------|--------|
| Database migration | 1 day |
| Backend type changes | 2 hours |
| Frontend null handling | 4 hours |
| Tests | 4 hours |
| **Total** | **2-3 days** |

---

## Migration Path

```
┌─────────────────────────────────────────────────────────────────┐
│                         Current State                           │
│  email: NOT NULL, all users have email                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Phase 1: Bridge Solution                     │
│  - LDAP users without email get placeholder                     │
│  - email: "\uE000NULL{md5_hash}"                                │
│  - UI hides placeholder emails                                  │
│  - Email operations skipped for placeholder                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (Future)
┌─────────────────────────────────────────────────────────────────┐
│                    Phase 2: Eventual Solution                   │
│  - email column becomes nullable                                │
│  - Placeholder emails migrated to NULL                          │
│  - Clean, honest representation                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

### Phase 1 (Bridge)

- [x] Add `NULL_EMAIL_MARKER_PREFIX` constant
- [x] Add `generate_null_email_marker()` function
- [x] Add `is_null_email_marker()` helper
- [x] Update `LDAPConfig` validation:
  - [x] Require `unique_id` when `email` is empty
  - [x] Require `allow_sign_up=True` when `email` is empty
  - [x] Disallow `PHOENIX_ADMINS` when `email` is empty
- [x] Update `LDAPUserInfo.email` type to `str | None`
- [x] Update `_authenticate()` to handle missing email attribute
- [x] Update `get_or_create_ldap_user()` for placeholder generation
- [x] Inject `nullEmailMarkerPrefix` into `window.Config`
- [x] Inject `ldapManualUserCreationEnabled` into `window.Config`
- [x] Add frontend `isNullEmailMarker()` helper in `app/src/utils/emailUtils.ts`
- [x] Update `UsersCard.tsx` to disable "Add User" button when no creation method available
- [x] Update `UsersTable.tsx` to hide placeholder emails
- [x] Update `ViewerProfileCard.tsx` to hide placeholder emails
- [x] Update `NewUserDialog.tsx` to hide LDAP option when manual creation disabled
- [x] Email sender naturally skips placeholder emails (via email validation)
- [x] Verify email validation rejects null markers (handled by EMAIL_PATTERN - no `@` symbol)
- [x] Add unit tests for null email marker helpers
- [x] Add integration tests for LDAP without email
- [x] Update documentation

### Phase 2 (Future)

- [ ] Create database migration
- [ ] Update SQLAlchemy model
- [ ] Update GraphQL types
- [ ] Update REST API models
- [ ] Update frontend to handle `null`
- [ ] Remove placeholder email helpers
- [ ] Migrate existing placeholder emails to `NULL`
- [ ] Update tests

---

## References

- [User Identification Strategy](./user-identification-strategy.md) - How Phoenix identifies LDAP users
- [README](./README.md) - LDAP authentication overview
