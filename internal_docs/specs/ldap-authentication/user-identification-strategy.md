# LDAP User Identification Strategy

## Overview

Phoenix identifies LDAP users using a stable identifier. The strategy depends on configuration:

| Mode | Identifier | `oauth2_user_id` | Survives |
|------|------------|------------------|----------|
| **Simple** (default) | Email | `NULL` | DN changes, OU moves, renames |
| **Enterprise** | Unique ID (objectGUID/entryUUID) | UUID string | Everything including email changes |

## Which Mode Should I Use?

**Use Simple Mode (default)** for most deployments:
- ✅ No extra configuration needed
- ✅ Handles DN changes, OU moves, renames
- ✅ Email is stable in most organizations
- ⚠️ If email changes in LDAP, user gets a new Phoenix account (admin can merge)

**Use Enterprise Mode only if** you expect user emails to change:
- Company rebranding (oldcorp.com → newcorp.com)
- Frequent name changes in your organization
- M&A scenarios with email domain migrations
- Compliance requirements for immutable user tracking

**The difference is narrow**: Both modes handle DN changes. The only additional benefit of Enterprise Mode is surviving **email changes** without creating duplicate accounts.

## Why Not DN?

DN (Distinguished Name) was considered but rejected as an identifier:

| Issue | Frequency | Impact |
|-------|-----------|--------|
| OU reorganization | Common (quarterly/annually) | Users locked out |
| Domain consolidation | Occasional (M&A) | Mass lockouts |
| User renames | Occasional | User locked out |
| DN casing variations | Multi-DC AD | Duplicate accounts |

**DNs change too frequently** in enterprise environments. Organizational restructuring is routine, and each change would orphan users or require admin intervention.

## Simple Mode (Default)

When `PHOENIX_LDAP_ATTR_UNIQUE_ID` is not set:

```
oauth2_user_id = NULL
Lookup: By email column (case-insensitive)
```

**Behavior:**

| Scenario | Behavior |
|----------|----------|
| DN changes (OU move, rename) | ✅ User found by email |
| Email unchanged | ✅ Normal login |
| Email changes in LDAP | ⚠️ New account created (admin intervention needed) |

**Implementation:**

```python
# Simple mode: lookup by email only
user = await session.scalar(
    select(User)
    .where(User.oauth2_client_id == LDAP_CLIENT_ID_MARKER)
    .where(func.lower(User.email) == email.lower())
)

# New user creation
user = User(
    email=email,
    oauth2_client_id=LDAP_CLIENT_ID_MARKER,
    oauth2_user_id=None,  # Not used in simple mode
    ...
)
```

**Why email works for most organizations:**
- Email changes are rare for individual users
- When emails do change (rebranding, mergers), it's a planned event
- Admins can merge accounts if needed

## Enterprise Mode (Unique ID)

When `PHOENIX_LDAP_ATTR_UNIQUE_ID` is set (e.g., `objectGUID`, `entryUUID`):

```
oauth2_user_id = <immutable unique ID from LDAP, lowercase normalized>
Lookup: By oauth2_user_id (case-insensitive), fallback to email for migration
```

**Configuration:**

```bash
# Active Directory
PHOENIX_LDAP_ATTR_UNIQUE_ID=objectGUID

# OpenLDAP (RFC 4530)
PHOENIX_LDAP_ATTR_UNIQUE_ID=entryUUID

# 389 Directory Server
PHOENIX_LDAP_ATTR_UNIQUE_ID=nsUniqueId
```

**Behavior:**

| Scenario | Behavior |
|----------|----------|
| DN changes (OU move, rename) | ✅ User found by unique_id |
| Email changes in LDAP | ✅ User found by unique_id, email updated |
| Domain consolidation | ✅ User found by unique_id |
| Migration from simple mode | ✅ Existing users matched by email, unique_id populated |
| Email recycled to new employee | ❌ 403 rejected (admin must resolve conflict) |

**Implementation:**

```python
# Enterprise mode: lookup by unique_id first (case-insensitive)
user = await session.scalar(
    select(User)
    .where(User.oauth2_client_id == LDAP_CLIENT_ID_MARKER)
    .where(func.lower(User.oauth2_user_id) == unique_id.lower())
)

# Fallback: email lookup (handles migration from simple mode)
if not user:
    user = await session.scalar(
        select(User)
        .where(User.oauth2_client_id == LDAP_CLIENT_ID_MARKER)
        .where(func.lower(User.email) == email.lower())
    )
    if user:
        # SECURITY: Only migrate if user has no existing unique_id
        # This prevents email recycling attacks (see Security section)
        if user.oauth2_user_id is None:
            user.oauth2_user_id = unique_id  # Migrate to unique_id
        elif user.oauth2_user_id.lower() != unique_id.lower():
            raise HTTPException(403, "Account conflict")  # Admin must resolve

# New user creation
user = User(
    email=email,
    oauth2_client_id=LDAP_CLIENT_ID_MARKER,
    oauth2_user_id=unique_id,  # Immutable identifier (lowercase)
    ...
)
```

## Unique ID Attribute Details

### Supported Attribute Types

**Only standard UUID-based attributes are supported:**

| Directory | Attribute | Format | Example |
|-----------|-----------|--------|---------|
| Active Directory | `objectGUID` | 16-byte binary (mixed-endian) | `0x...` → `550e8400-e29b-41d4-...` |
| OpenLDAP | `entryUUID` | String UUID (36 bytes) | `550e8400-e29b-41d4-a716-...` |
| 389 DS | `nsUniqueId` | String UUID | `550e8400-e29b-41d4-a716-...` |

**Not supported:**
- Custom attributes containing 16-character string IDs (e.g., `"EMP12345ABCD6789"`)
- Arbitrary binary formats that aren't UUIDs

**Why this limitation?**
- 16-byte values are assumed to be binary UUIDs (AD `objectGUID`)
- A 16-character string ID would be incorrectly converted via `uuid.UUID(bytes_le=...)`
- This produces a garbled UUID that doesn't match the original string
- Implementing a heuristic to distinguish them has a ~1 in 7.7 million false positive rate, which is unacceptable for large deployments

If your organization uses non-standard unique ID attributes, use **Simple Mode** (email-based identification) instead.

### Active Directory: objectGUID

- **Type**: Binary (16 bytes, mixed-endian per MS-DTYP §2.3.4)
- **Immutability**: Never changes, survives all operations
- **Availability**: All AD user objects
- **Phoenix handling**: Converted to lowercase UUID string

```python
# AD stores GUID in mixed-endian format (MS-DTYP §2.3.4):
# - Data1 (4 bytes): little-endian
# - Data2 (2 bytes): little-endian
# - Data3 (2 bytes): little-endian
# - Data4 (8 bytes): big-endian
import uuid
unique_id = str(uuid.UUID(bytes_le=raw_bytes))  # e.g., "550e8400-e29b-41d4-a716-446655440000"
```

### OpenLDAP: entryUUID (RFC 4530)

- **Type**: String (UUID format, 36 bytes as UTF-8)
- **Immutability**: Never changes
- **Availability**: Requires `entryUUID` operational attribute
- **Phoenix handling**: Decoded from bytes, normalized to lowercase
- **Note**: ldap3 returns as bytes even for string attributes (`b"550e8400-..."`)

### 389 Directory Server: nsUniqueId

- **Type**: String (UUID format)
- **Immutability**: Never changes
- **Phoenix handling**: Normalized to lowercase

### Case Normalization

All unique IDs are normalized to **lowercase** for consistent database lookups:

- UUIDs are case-insensitive per RFC 4122/9562
- Prevents duplicate accounts from case variations
- Database lookups are case-insensitive (`func.lower()`)
- Existing entries with different casing are updated on next login

## Security: Email Recycling Attack Prevention

In enterprise mode, the email fallback logic must prevent **email recycling attacks**:

**Attack Scenario (without protection):**
1. User A leaves company (DB: `email=john@corp.com`, `oauth2_user_id=UUID-A`)
2. User B joins with recycled email (LDAP: `email=john@corp.com`, `unique_id=UUID-B`)
3. User B logs in:
   - unique_id lookup: `UUID-B` not found
   - email lookup: finds User A!
   - **Without protection**: Updates User A's `oauth2_user_id` to `UUID-B`
   - User B now has access to User A's data! 🚨

**Protection implemented:**
```python
if user.oauth2_user_id is None:
    user.oauth2_user_id = unique_id  # Safe migration from simple mode
elif user.oauth2_user_id.lower() != unique_id.lower():
    raise HTTPException(status_code=403, ...)  # Reject - admin must resolve
```

**Protected behavior:**
| Email lookup finds | `oauth2_user_id` | Action |
|--------------------|------------------|--------|
| User | `NULL` | ✅ Migrate: set `oauth2_user_id` |
| User | Same UUID (any case) | ✅ Login OK (normalize case if needed) |
| User | Different UUID | ❌ **403 Rejected** (admin must resolve) |

**Why rejection instead of new account?**
- Email is unique in the database (`CREATE UNIQUE INDEX ix_users_email`)
- Cannot create a new user with the same email
- Admin must resolve: delete old account, update old account's unique_id, or change email

**Result:** Email recycling is explicitly rejected, preventing both account hijacking and confusing database errors.

## Switching from Simple to Enterprise Mode

If you start with simple mode (email-based) and later enable `PHOENIX_LDAP_ATTR_UNIQUE_ID`:

1. Set `PHOENIX_LDAP_ATTR_UNIQUE_ID=objectGUID` (or `entryUUID`, etc.)
2. Users log in normally
3. Email lookup finds existing user
4. `oauth2_user_id` populated with unique_id
5. Future logins use unique_id lookup

**No manual migration required** - happens automatically on next login.

## Admin-Provisioned Users

Admins can pre-create LDAP users before their first login:

```graphql
mutation {
  createUser(
    email: "alice@example.com"
    username: "Alice Smith"
    role: MEMBER
    auth_method: LDAP
  )
}
```

**State after admin creation:**
- `oauth2_client_id = LDAP_CLIENT_ID_MARKER`
- `oauth2_user_id = NULL`
- `email = "alice@example.com"`

**State after first login:**
- Simple mode: `oauth2_user_id` remains `NULL`
- Enterprise mode: `oauth2_user_id = <unique_id from LDAP>`

## Comparison with Other Systems

### Grafana

Grafana uses DN as the primary identifier (stored in `user_auth.auth_id`).

| Aspect | Grafana | Phoenix |
|--------|---------|---------|
| Primary identifier | DN | Email (simple) or unique_id (enterprise) |
| DN changes | User locked out | ✅ Handled |
| Email changes | ✅ Handled via DN | ✅ Handled via unique_id (enterprise) |
| Schema | Separate `user_auth` table | Uses `oauth2_user_id` column |

**Phoenix's advantage**: More resilient to organizational restructuring.

### Okta, Azure AD Connect

Enterprise IAM systems use `objectGUID`/`entryUUID` as the primary identifier.

**Phoenix enterprise mode matches this pattern** when `PHOENIX_LDAP_ATTR_UNIQUE_ID` is configured.

## Design Decision Summary

| Decision | Rationale |
|----------|-----------|
| **Email as default identifier** | Simple, works for most orgs, no extra config |
| **Optional unique_id support** | Enterprise-grade stability when needed |
| **No DN storage for lookup** | DNs change too frequently |
| **No email in oauth2_user_id** | Avoid redundant storage |
| **Fallback to email in enterprise mode** | Graceful migration from simple mode |
| **Lowercase normalization** | UUIDs are case-insensitive (RFC 4122), prevents mismatches |
| **Case-insensitive DB lookup** | Handles legacy data with different casing |
| **Email recycling protection** | Prevents account hijacking via recycled emails |
| **UUID-only unique_id support** | Heuristics for 16-char strings have unacceptable false positive rates |

## References

- [RFC 4122 - UUID URN Namespace](https://www.rfc-editor.org/rfc/rfc4122.html) (UUIDs are case-insensitive)
- [RFC 9562 - UUID Version 7](https://www.rfc-editor.org/rfc/rfc9562.html) (Updated UUID spec, maintains case-insensitivity)
- [RFC 4530 - entryUUID operational attribute](https://www.rfc-editor.org/rfc/rfc4530.html)
- [MS-DTYP §2.3.4 - GUID Structure](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-dtyp/001eec5a-7f8b-4293-9e21-ca349392db40) (Mixed-endian format)
- [MS-ADTS - objectGUID attribute](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-adts/)
- [Okta LDAP Agent - User Matching](https://help.okta.com/en/prod/Content/Topics/Directory/LDAP-agent-overview.htm)
