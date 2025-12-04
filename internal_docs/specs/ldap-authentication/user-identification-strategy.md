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
oauth2_user_id = <immutable unique ID from LDAP>
Lookup: By oauth2_user_id, fallback to email for migration
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

**Implementation:**

```python
# Enterprise mode: lookup by unique_id first
user = await session.scalar(
    select(User)
    .where(User.oauth2_client_id == LDAP_CLIENT_ID_MARKER)
    .where(User.oauth2_user_id == unique_id)
)

# Fallback: email lookup (handles migration)
if not user:
    user = await session.scalar(
        select(User)
        .where(User.oauth2_client_id == LDAP_CLIENT_ID_MARKER)
        .where(func.lower(User.email) == email.lower())
    )
    if user:
        user.oauth2_user_id = unique_id  # Migrate to unique_id

# New user creation
user = User(
    email=email,
    oauth2_client_id=LDAP_CLIENT_ID_MARKER,
    oauth2_user_id=unique_id,  # Immutable identifier
    ...
)
```

## Unique ID Attribute Details

### Active Directory: objectGUID

- **Type**: Binary (16 bytes, little-endian)
- **Immutability**: Never changes, survives all operations
- **Availability**: All AD user objects
- **Phoenix handling**: Converted to UUID string format

```python
# AD stores GUID in mixed-endian format
import uuid
unique_id = str(uuid.UUID(bytes_le=raw_bytes))  # e.g., "550e8400-e29b-41d4-a716-446655440000"
```

### OpenLDAP: entryUUID (RFC 4530)

- **Type**: String (UUID format)
- **Immutability**: Never changes
- **Availability**: Requires `entryUUID` operational attribute
- **Phoenix handling**: Used directly as string

### 389 Directory Server: nsUniqueId

- **Type**: String
- **Immutability**: Never changes
- **Phoenix handling**: Used directly as string

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

## References

- [RFC 4530 - entryUUID operational attribute](https://www.rfc-editor.org/rfc/rfc4530.html)
- [MS-ADTS - objectGUID attribute](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-adts/)
- [Okta LDAP Agent - User Matching](https://help.okta.com/en/prod/Content/Topics/Directory/LDAP-agent-overview.htm)
