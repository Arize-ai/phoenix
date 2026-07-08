# OAuth2/OIDC Email Attribute Path Configuration

## Problem Statement

When using Microsoft Entra ID (Azure AD) as an OAuth2 identity provider, Phoenix requires the `email` claim to be present in the ID token. However, Entra ID users might not have the `mail` attribute populated in their directory.

Even with the `email` optional claim configured in the Entra ID app registration, if the user's `mail` attribute is empty, the `email` claim will not be included in the token.

**Current Error:**
> "Missing or invalid 'email' claim. Please ensure your OIDC provider is configured to include the 'email' scope."

**GitHub Issue:** https://github.com/Arize-ai/phoenix/issues/11065

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Background](#background)
3. [Design Decision](#design-decision)
4. [Solution](#solution)
5. [Implementation Plan](#implementation-plan)
6. [Testing Plan](#testing-plan)
7. [Operational Considerations](#operational-considerations)
8. [Known Limitations](#known-limitations)
9. [Future Considerations](#future-considerations)
10. [Summary](#summary)
11. [References](#references)

---

## Background

### Azure AD Claim Analysis

| Claim | Description | Unique? | Email Format? | Availability |
|-------|-------------|---------|---------------|--------------|
| `sub` | OIDC subject identifier (UUID) | ✅ Globally | ❌ | ✅ Always |
| `email` | User's email address | ❌ | ✅ | ❌ May be null |
| `preferred_username` | User's login identifier | ✅ Per tenant | ⚠️ Not guaranteed | ⚠️ v2.0 + `profile` scope |
| `upn` | User Principal Name | ✅ Per tenant | ✅ Always `user@domain` | ⚠️ v2.0 optional claim |
| `name` | Display name | ❌ | ❌ | ⚠️ `profile` scope |

**Key facts:**

- **`preferred_username` and `upn` are different claims.** Per [Microsoft docs](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference), `preferred_username` "could be an email address, phone number, or a generic username without a specified format."
- **For Azure AD specifically**, `preferred_username` typically contains the UPN value (which is email-formatted), but this is not guaranteed by the OIDC spec.
- **UPN is always email-formatted** because Azure AD requires the UPN suffix to be a valid, verified domain (RFC 822 compliant). See [Microsoft Entra UserPrincipalName population](https://learn.microsoft.com/en-us/entra/identity/hybrid/connect/plan-connect-userprincipalname).
- **`upn` in v2.0 tokens** is an [optional claim](https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims-reference) that must be explicitly configured in Token Configuration.
- **`preferred_username` availability**: Present by default in v2.0 tokens when requesting the `profile` scope. See [Microsoft ID token claims reference](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference).

### Grafana's Approach

Grafana handles this scenario in two ways:

1. **Azure AD Connector** — Hardcoded fallback to `preferred_username`:
   ```go
   func (claims *azureClaims) extractEmail() string {
       if claims.Email == "" {
           if claims.PreferredUsername != "" {
               return claims.PreferredUsername
           }
       }
       return claims.Email
   }
   ```

2. **Generic OAuth** — Configurable JMESPath:
   - `email_attribute_path` — JMESPath expression to extract email
   - `email_attribute_name` — Key name in Attributes map
   - Automatic fallback to parse `upn` as email

---

## Design Decision

### Approaches Considered and Rejected

**1. Automatic Fallback Chain**

```python
# Rejected
for claim in ["email", "preferred_username", "upn"]:
    value = user_claims.get(claim)
    if value and is_valid_email_format(value):
        return value
```

**Problems:**
- Hardcodes Azure AD knowledge into Phoenix
- Phoenix can't reliably detect Azure AD (IDP name is user-defined)
- Creates implicit, unexpected behavior for other IDPs

**2. Separate Database Column for User Identifier**

| Entity | Example (Azure AD) | Current Column |
|--------|-------------------|----------------|
| Subject ID | `abc123-uuid-...` | `oauth2_user_id` ✅ |
| Login Identifier | `john.doe@company.onmicrosoft.com` (UPN) | **nowhere** |
| Display Name | `John Doe` | `username` ✅ |
| Contact Email | `john.doe@company.com` (might be null) | `email` |

**Problem:** Adding a new column requires database migration.

**3. Allow Null Email (Like LDAP)**

LDAP supports optional email when `PHOENIX_LDAP_ATTR_EMAIL` is empty, but this disables admin provisioning. Enterprise environments often need admin pre-provisioning.

### Chosen Approach: Configurable JMESPath Extraction

**Core justification:** Phoenix does not validate email format for OAuth2 users. The `email` column only requires:
1. Non-empty string
2. Unique value
3. Sanitization (trim + lowercase)

Phoenix already accepts whatever the IDP provides. We're changing *which claim* to trust, not *how* we validate it.

**Why this works for Azure AD:**
1. `preferred_username` is non-empty and unique — satisfies column constraints
2. For Azure AD, it typically contains the UPN — which is email-formatted
3. Consistent with existing patterns (`GROUPS_ATTRIBUTE_PATH`, `ROLE_ATTRIBUTE_PATH`)

**Note on backward compatibility:** Adding email format validation now would be a breaking change. Existing OAuth2 users might already have non-email values stored. This feature respects the existing contract.

---

## Solution

### Configuration

```bash
# JMESPath expression to extract email from claims
# Default: "email" (OIDC standard claim)
PHOENIX_OAUTH2_{IDP}_EMAIL_ATTRIBUTE_PATH=preferred_username
```

### Recommended Configuration for Azure AD

**TL;DR:** Use `preferred_username`. It requires no Azure AD configuration changes.

| Claim | Phoenix Config | Azure AD Config Required |
|-------|----------------|-------------------------|
| `preferred_username` | `EMAIL_ATTRIBUTE_PATH=preferred_username` | ✅ None — available by default in v2.0 tokens with `profile` scope |
| `upn` | `EMAIL_ATTRIBUTE_PATH=upn` | ❌ Must add as optional claim in Azure Portal → Token Configuration |

**Prerequisites for `preferred_username`:**
- Phoenix already requests `openid email profile` by default
- The `profile` scope includes `preferred_username` in v2.0 tokens
- No scope or Azure configuration change required

**Edge case:** If `preferred_username` is not in email format (e.g., phone number or plain username), it will still be stored since Phoenix does not validate email format. The `mailto:` link may malfunction, but login works.

### Behavior

| Configuration | Claim Used | Notes |
|--------------|------------|-------|
| Not set (default) | `email` | Standard OIDC behavior |
| `=preferred_username` | `preferred_username` | **Recommended for Azure AD** |
| `=upn` | `upn` | Requires Azure AD optional claim config |
| `=some.nested.path` | JMESPath result | For custom claims |

### Extraction Logic

```python
import jmespath
from phoenix.auth import sanitize_email

def extract_email(user_claims: dict, email_attribute_path: str) -> str | None:
    """Extract email from user claims using configured path.
    
    Args:
        user_claims: Merged claims from ID token and/or UserInfo endpoint
        email_attribute_path: JMESPath expression (default: "email")
    
    Returns:
        Extracted email string (lowercased), or None if not found/empty
    """
    if not email_attribute_path:
        email_attribute_path = "email"
    
    value = jmespath.search(email_attribute_path, user_claims)
    
    if isinstance(value, str) and value.strip():
        return sanitize_email(value)  # trim + lowercase
    
    return None
```

### Case Sensitivity

**Path is case-sensitive:** JMESPath claim names must match exactly. `preferred_username` works, but `Preferred_Username` or `preferredUsername` will not.

**Values are lowercased:** All extracted values go through `sanitize_email()` which lowercases them. This is existing behavior for all email values in Phoenix.

**Why lowercasing is safe:** Azure AD enforces UPN uniqueness case-insensitively. Two users cannot exist with UPNs `User@Domain.com` and `user@domain.com`. See [LDAP String Syntax](https://learn.microsoft.com/en-us/windows/win32/adschema/a-userprincipalname).

**Admin provisioning works:** Admin can provision with `John.Doe@Company.com` and IDP can return `john.doe@company.com` — they match because both are lowercased before comparison.

### Error Handling

If extraction returns `None`, raise `MissingEmailScope` with the configured path in the message:

```python
email = extract_email(user_claims, config.email_attribute_path)
if not email:
    path = config.email_attribute_path or "email"
    raise MissingEmailScope(
        f"Missing or invalid '{path}' claim. "
        "Please ensure your OIDC provider includes this claim, "
        "or configure PHOENIX_OAUTH2_{IDP}_EMAIL_ATTRIBUTE_PATH."
    )
```

---

## Implementation Plan

### Phase 1: Add Configuration

**File:** `src/phoenix/config.py`

```python
@dataclass
class OAuth2ClientConfig:
    # ... existing fields ...
    
    email_attribute_path: Optional[str] = None
    """JMESPath expression to extract email from user claims.
    
    Default: "email" (standard OIDC claim)
    
    For Azure AD/Entra ID without email attribute:
        PHOENIX_OAUTH2_AZURE_AD_EMAIL_ATTRIBUTE_PATH=preferred_username
    """
```

Environment variable parsing:

```python
email_attribute_path = getenv(
    f"PHOENIX_OAUTH2_{idp_name.upper()}_EMAIL_ATTRIBUTE_PATH",
    None  # None means use default "email"
)
```

### Phase 2: Update Extraction Logic

**File:** `src/phoenix/server/api/routers/oauth2.py`

```python
def _parse_user_info(
    user_info: dict[str, Any],
    email_attribute_path: str | None = None,
) -> UserInfo:
    """Parse and validate user info from OIDC claims."""
    
    path = email_attribute_path or "email"
    email = jmespath.search(path, user_info)
    
    if not isinstance(email, str) or not email.strip():
        raise MissingEmailScope(
            f"Missing or invalid '{path}' claim. "
            "Please ensure your OIDC provider includes this claim."
        )
    email = email.strip()
    
    # ... rest unchanged ...
```

### Phase 3: Pass Configuration Through

**File:** `src/phoenix/server/api/routers/oauth2.py`

```python
user_info = _parse_user_info(
    user_claims,
    email_attribute_path=oauth2_client.email_attribute_path,
)
```

### Phase 4: JMESPath Dependency

JMESPath is already a dependency — used in `src/phoenix/server/oauth2.py` for `GROUPS_ATTRIBUTE_PATH` and `ROLE_ATTRIBUTE_PATH`. No changes needed.

### Phase 5: Update Documentation

**Files:**
- `docs/` — Add configuration example for Azure AD
- Error messages — Include configuration hint

**Key points to document:**
1. Values are **lowercased** before storage (existing behavior)
2. Admin provisioning is case-insensitive
3. Not a breaking change — all OAuth2 emails already lowercased via `sanitize_email()`

---

## Testing Plan

### Unit Tests

1. **Default behavior** — `email_attribute_path=None` uses `email` claim
2. **Custom path** — `email_attribute_path="preferred_username"` extracts correctly
3. **Nested path** — `email_attribute_path="attributes.email"` works with JMESPath
4. **Missing claim** — Raises `MissingEmailScope` with helpful message
5. **Empty value** — Empty string treated as missing
6. **Case handling** — Extracted values are lowercased

### Integration Tests

1. **Azure AD simulation** — Claims with `preferred_username` but no `email`
2. **Admin provisioning** — User provisioned by UPN, matched on login
3. **Standard IDP** — Default behavior unchanged

---

## Operational Considerations

### Admin Provisioning

Admins typically know users' UPNs because UPN is the login username. When using `EMAIL_ATTRIBUTE_PATH=preferred_username`:

- Admin provisions users using their UPN (e.g., `john.doe@company.onmicrosoft.com`)
- On first login, user is matched by email (before `oauth2_user_id` is set)
- Subsequent logins match by `sub` claim (stored in `oauth2_user_id`)

**Important:** Admin must provision using the exact value the IDP returns. If admin provisions with `user@company.com` but IDP returns `user@company.onmicrosoft.com`, first login won't match.

### Email Routing (SMTP)

UPN is an identity identifier, not a guaranteed contact address:

- `user@company.onmicrosoft.com` — May or may not have a mailbox
- `user@company.com` — Only works if mailboxes are configured

**Impact:**
- `mailto:` links in Phoenix UI may not work
- Emails sent to non-routable UPNs will bounce
- This is no different from the current state where `email` claim could contain a non-deliverable address

### UPN Changes in Azure AD

If a user's UPN changes in Azure AD (name change, domain migration):
- **After first login:** User is matched by `sub` (stored in `oauth2_user_id`) — no issue
- **Admin-provisioned users who haven't logged in yet:** Could fail to match on first login if provisioned with old UPN

This is mitigated because `oauth2_user_id` (the `sub` claim) is stable and used for matching after the first successful login.

### Changing Configuration for Existing Deployments

If `EMAIL_ATTRIBUTE_PATH` is changed after users exist:
- Existing users are matched by `sub` (stored in `oauth2_user_id`) on next login
- Their `email` column is updated to the new extracted value
- No data loss, but the displayed email value changes

**Email uniqueness collision:** If the new extracted value collides with another user's email:
- The code catches the `IntegrityError` and raises `EmailAlreadyInUse`
- Login fails with error "An account for {email} is already in use"
- Admin must resolve the conflict (delete or update the conflicting user record)

### Rollback Scenario (Critical Limitation)

**Scenario:**
1. Admin deploys with `EMAIL_ATTRIBUTE_PATH=preferred_username`
2. Users log in, their `oauth2_user_id` is set, email column contains UPNs
3. Admin rolls back config (removes `EMAIL_ATTRIBUTE_PATH`, defaults to `email`)
4. User logs in again
5. **User is locked out**

**Why this happens:** The current OAuth2 flow parses user info (including email extraction) **before** user lookup:

```python
# Current flow in oauth2.py
user_info = _parse_user_info(user_claims)  # ← Fails here if email claim is null
# Never reaches user lookup by oauth2_user_id
```

If email extraction fails, `MissingEmailScope` is raised before we can match the user by `oauth2_user_id`.

**Workarounds:**
1. **Don't roll back** if the `email` claim is still null — that's the whole reason for the config
2. **Fix the IDP** to populate the `email` claim before rolling back
3. **Manual database update** — set users' email back to their real email (if known)

**Future consideration:** The flow could be changed to attempt `oauth2_user_id` lookup first, only requiring email extraction for new users. This would make the config change more reversible.

### Per-IDP Configuration

Each IDP can have different settings:

```bash
PHOENIX_OAUTH2_GOOGLE_EMAIL_ATTRIBUTE_PATH=email          # default
PHOENIX_OAUTH2_AZURE_AD_EMAIL_ATTRIBUTE_PATH=preferred_username  # custom
```

### Azure AD v1.0 Endpoints

Microsoft Entra ID has two OIDC endpoint versions:
- v1.0: `https://login.microsoftonline.com/{tenant}/oauth2/authorize`
- v2.0: `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize`

If using v1.0 (no `/v2.0/` in the URL):
- `preferred_username` is not available by default
- Options:
  1. Add `preferred_username` as optional claim in Azure Portal
  2. Use `upn` instead (also requires optional claim configuration)
  3. Migrate to v2.0 endpoints (recommended by Microsoft)

---

## Known Limitations

### Critical

1. **Configuration rollback locks out users** — If you enable `EMAIL_ATTRIBUTE_PATH`, users log in, then roll back the config while `email` claim is still null, users are locked out. See [Rollback Scenario](#rollback-scenario-critical-limitation) for details.

2. **Email collision on config change** — If the new extracted value matches another user's email, login fails with "An account for {email} is already in use." Admin must manually resolve the conflict.

### Semantic

3. **Column named `email` may contain non-email values** — The column is effectively a "user identifier" field. Future developers might assume email format.

4. **UI label says "Email"** — Users see their UPN in a field labeled "Email" which may be confusing.

### Integration

5. **External integrations may break** — If Phoenix user data is exported to systems expecting valid email addresses, those integrations might fail validation.

### Configuration

6. **JMESPath misconfiguration** — Typos or wrong syntax fail silently (treated as missing claim). Error messages should clarify which path was attempted.

7. **JMESPath returns non-string** — Arrays, objects, or non-string values are treated as missing.

---

## Future Considerations

### `EMAIL_ATTRIBUTE_PATH=null` (Optional Email)

For IDPs with no email-like claim at all:

```bash
PHOENIX_OAUTH2_{IDP}_EMAIL_ATTRIBUTE_PATH=null
```

**Behavior:**
- Generate null email marker (reuse LDAP infrastructure)
- Require `ALLOW_SIGN_UP=True` (disable admin provisioning)
- User matched by `sub` (`oauth2_user_id`) only

**Why deferred:** The original issue (#11065) is Azure AD where UPN is always available. `EMAIL_ATTRIBUTE_PATH=preferred_username` solves it. `=null` is for rarer edge cases.

### Username Attribute Path

`USERNAME_ATTRIBUTE_PATH` was considered but deferred:
- Current `name` claim extraction works for most cases
- Username collision handling already exists (random suffix)
- Can be added if demand emerges

---

## Summary

| Aspect | Decision |
|--------|----------|
| **Approach** | Configurable JMESPath extraction |
| **Configuration** | `PHOENIX_OAUTH2_{IDP}_EMAIL_ATTRIBUTE_PATH` |
| **Default** | `"email"` (OIDC standard, backward compatible) |
| **Azure AD solution** | Set to `preferred_username` (no Azure config needed) |
| **Value processing** | Lowercased via `sanitize_email()` (existing behavior) |
| **Validation** | None (OAuth2 emails not format-validated) |
| **Admin provisioning** | Works (UPN is unique per tenant) |
| **Complexity** | Low — follows existing `GROUPS_ATTRIBUTE_PATH` pattern |

---

## References

- GitHub Issue: https://github.com/Arize-ai/phoenix/issues/11065
- Grafana Generic OAuth: https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication/generic-oauth/
- Grafana Azure AD: https://grafana.com/docs/grafana/latest/setup-grafana/configure-security/configure-authentication/azuread/
- Microsoft Entra ID Claims: https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference
- Microsoft UPN Population: https://learn.microsoft.com/en-us/entra/identity/hybrid/connect/plan-connect-userprincipalname
- LDAP String Syntax (Case Sensitivity): https://learn.microsoft.com/en-us/windows/win32/adschema/a-userprincipalname
- LDAP Optional Email Design: [./ldap-authentication/optional-email.md](./ldap-authentication/optional-email.md)
