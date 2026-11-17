# LDAP User Identification Strategy

## Overview

Phoenix needs a stable key to find an LDAP user's row on each login. The key depends on configuration:

| Mode | Configuration | Key | Survives |
|------|---------------|-----|----------|
| **Simple** (default) | `PHOENIX_LDAP_ATTR_UNIQUE_ID` unset | `email` | DN changes, OU moves, renames |
| **Enterprise** | `PHOENIX_LDAP_ATTR_UNIQUE_ID` set | `ldap_unique_id`, then `email` | All of the above, plus email changes |
| **Null email** | `PHOENIX_LDAP_ATTR_EMAIL=null` and `PHOENIX_LDAP_ATTR_UNIQUE_ID` set | `ldap_unique_id` only | All of the above |

The lookup logic is `get_or_create_ldap_user` in `src/phoenix/server/api/routers/ldap.py`.

## Which Mode to Use

Simple mode suits most deployments. It needs no extra configuration, and email is stable in most organizations. If a user's email changes in LDAP, the user gets a new Phoenix account.

Enterprise mode is worth configuring when emails are expected to change: a rebranding that changes the email domain, a merger, or frequent name changes. Both modes handle DN changes. The only additional benefit of enterprise mode is surviving email changes.

Null-email mode is for directories that do not populate an email attribute. See [Optional Email for LDAP Users](./optional-email.md).

## Why Not DN

DNs were rejected as an identifier because they change too often:

| Event | Frequency | Effect if DN were the key |
|-------|-----------|---------------------------|
| OU reorganization | Common | Users locked out |
| Domain consolidation | Occasional (mergers) | Mass lockouts |
| User rename | Occasional | User locked out |
| DN casing variation | Multi-DC Active Directory | Duplicate accounts |

Phoenix canonicalizes DNs for group matching ([Protocol Compliance §8](./protocol-compliance.md#8-dn-canonicalization--rfc-4514-compliance)), but never stores a DN.

## Lookup Rules

**Simple mode**: look up by `email`, case-insensitively.

**Enterprise mode**:

1. Look up by `ldap_unique_id`, case-insensitively.
2. If no row matches, look up by `email`. When that finds a row:
   - If the row's `ldap_unique_id` is NULL, store the unique ID. This is how a deployment moves from simple to enterprise mode, and how admin-provisioned users get their ID.
   - If the row's `ldap_unique_id` matches, normalize its case.
   - If the row's `ldap_unique_id` differs, reject the login. See [Email Recycling](#email-recycling).

**Null-email mode**: look up by `ldap_unique_id` only. There is no email to fall back to.

When no row matches and `PHOENIX_LDAP_ALLOW_SIGN_UP` is true, Phoenix creates an `LDAPUser`. On every login, Phoenix syncs the email and role from LDAP. It does not sync the username, because a changed `displayName` could collide with another user's username.

## Email Recycling

The email fallback must not let a new employee inherit a former employee's account:

1. User A leaves. Their row has `email=john@corp.com` and `ldap_unique_id=UUID-A`.
2. User B joins, and LDAP reuses `john@corp.com` with `unique_id=UUID-B`.
3. User B logs in. The unique-ID lookup finds nothing, and the email lookup finds User A's row.

If Phoenix overwrote `UUID-A` with `UUID-B`, User B would get User A's data. Phoenix instead rejects the login with the same generic 401 response as a wrong password, and logs the conflict for an admin. Phoenix cannot create a second row for User B, because `email` is unique. An admin resolves the conflict by deleting the old account, changing its email, or changing its unique ID.

## Unique ID Attributes

Only UUID-valued attributes are supported:

| Directory | Attribute | Format |
|-----------|-----------|--------|
| Active Directory | `objectGUID` | 16-byte binary, mixed-endian (MS-DTYP §2.3.4) |
| OpenLDAP | `entryUUID` | String UUID (RFC 4530) |
| 389 Directory Server | `nsUniqueId` | String UUID |

Phoenix converts a 16-byte value with `uuid.UUID(bytes_le=...)` and decodes a string value as text. It stores every ID in lowercase, because UUIDs are case-insensitive (RFC 4122, RFC 9562).

A custom attribute holding a 16-character string ID is not supported. Phoenix would treat its 16 bytes as a binary GUID and produce a wrong UUID. A heuristic to tell the two apart would misclassify about 1 in 7.7 million IDs, which is too many for large directories. Directories without a UUID attribute should use simple mode.

## Admin-Provisioned Users

An admin can create an LDAP user before the first login, in the user management UI or through `PHOENIX_ADMINS`. The row has an `email` and a NULL `ldap_unique_id`. On first login, the email lookup finds the row, and enterprise mode stores the unique ID. Pre-provisioning is not possible in null-email mode, because there is no email to match.

## Comparison with Other Systems

| Aspect | Grafana | Phoenix |
|--------|---------|---------|
| Key | DN (`user_auth.auth_id`) | Email, or unique ID |
| DN change | User locked out | Handled |
| Email change | Handled through the DN | Handled in enterprise mode |
| Storage | Separate `user_auth` table | `ldap_unique_id` column on `users` |

Okta and Azure AD Connect key users on `objectGUID` or `entryUUID`. Phoenix's enterprise mode follows the same pattern.

## References

- [RFC 4122 - UUID URN Namespace](https://www.rfc-editor.org/rfc/rfc4122.html)
- [RFC 9562 - Universally Unique IDentifiers](https://www.rfc-editor.org/rfc/rfc9562.html)
- [RFC 4530 - entryUUID operational attribute](https://www.rfc-editor.org/rfc/rfc4530.html)
- [MS-DTYP §2.3.4 - GUID Structure](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-dtyp/001eec5a-7f8b-4293-9e21-ca349392db40)
- [Okta LDAP Agent - User Matching](https://help.okta.com/en/prod/Content/Topics/Directory/LDAP-agent-overview.htm)
