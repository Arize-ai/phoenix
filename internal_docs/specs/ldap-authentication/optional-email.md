# Optional Email for LDAP Users

## Problem

Some LDAP directories do not populate the `mail` attribute. Phoenix originally required an email for every user, so those organizations could not use LDAP login.

## Decision

An LDAP user's `email` column may be NULL. Such a user is identified by `ldap_unique_id` alone. See [Database Schema](./database-schema.md) for the constraint that every LDAP row has an email, a unique ID, or both.

## Configuration

Null-email mode is on when `PHOENIX_LDAP_ATTR_EMAIL` is `null` or empty:

```bash
PHOENIX_LDAP_ATTR_EMAIL=null
PHOENIX_LDAP_ATTR_UNIQUE_ID=objectGUID
```

When `PHOENIX_LDAP_ATTR_EMAIL` is unset, Phoenix reads `mail` and logs a deprecation warning, because the variable will become required. When it names an attribute, that attribute must be present on the user's entry, or the login fails. Phoenix never falls back silently.

`LDAPConfig.from_env()` rejects these combinations at startup:

| Requirement in null-email mode | Reason |
|--------------------------------|--------|
| `PHOENIX_LDAP_ATTR_UNIQUE_ID` is set | Without an email, the unique ID is the only way to find a returning user. |
| `PHOENIX_LDAP_ALLOW_SIGN_UP` is `true` | Pre-provisioned users are matched by email, so without email every user must be created at first login. |
| `PHOENIX_ADMINS` is not set | `PHOENIX_ADMINS` creates users by email. Grant admin rights through `PHOENIX_LDAP_GROUP_ROLE_MAPPINGS` instead. |

## Behavior

| Scenario | `PHOENIX_LDAP_ATTR_EMAIL` | `PHOENIX_LDAP_ATTR_UNIQUE_ID` | `email` column | Lookup |
|----------|---------------------------|-------------------------------|----------------|--------|
| Standard | `mail` | unset | Email from LDAP | By email |
| Enterprise | `mail` | `objectGUID` | Email from LDAP | By unique ID, then email |
| No email | `null` | `objectGUID` | NULL | By unique ID only |

Users without an email:

- Do not receive welcome emails or any other email from Phoenix.
- Appear in the UI by username. Email fields are hidden.
- Are returned with `email: null` by GraphQL, and with `"email": ""` by the REST API (`/v1/users`), which keeps its existing string type.
- Cannot be created by an admin in the UI. In null-email mode, `window.Config.ldapManualUserCreationEnabled` is false, so the new-user dialog hides its LDAP tab.

Switching modes needs no manual migration. Existing users keep their email when a deployment switches to null-email mode. When a deployment switches from null-email mode to an email attribute, each user's email is filled in at their next login, because Phoenix syncs the email on every login.

## History

The first implementation could not make `email` nullable. It stored a placeholder of the form `\ue000NULL(stopgap){md5(unique_id)}`, which the API layers translated to null or empty. The Unicode private-use prefix kept placeholders from colliding with real emails, and the missing `@` made every email validator reject them. Migration `a1b2c3d4e5f6` made the column nullable and replaced every placeholder with NULL.

## References

- [User Identification Strategy](./user-identification-strategy.md)
- [Database Schema](./database-schema.md)
