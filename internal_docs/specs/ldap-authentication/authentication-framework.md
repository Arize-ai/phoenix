## Authentication Method Framework

### Configuration Permutations & Behavior Matrix

Phoenix now supports three authentication methods: **LOCAL** (username/password), **OAuth2** (OIDC), and **LDAP**. The framework must handle all valid permutations coherently.

#### Configuration Variables

| Variable | Effect |
|----------|--------|
| `PHOENIX_ENABLE_AUTH` | Enables authentication system (default: `false`) |
| `PHOENIX_DISABLE_BASIC_AUTH` | Disables LOCAL auth (default: `false`) |
| `PHOENIX_OAUTH2_*` | Configures OAuth2/OIDC providers (optional) |
| `PHOENIX_LDAP_HOST` | Enables LDAP authentication (optional) |

#### Validation Rules (Backend: `config.py`)

```python
def get_env_auth_settings() -> AuthSettings:
    # ...
    oauth2_clients = OAuth2Clients.from_configs(get_env_oauth2_settings())
    ldap_config = LDAPConfig.from_env()
    
    # ✅ CRITICAL VALIDATION
    if enable_auth and disable_basic_auth and not oauth2_clients and not ldap_config:
        raise ValueError(
            f"{ENV_PHOENIX_DISABLE_BASIC_AUTH} is set, but no alternative authentication methods "
            "are configured. Please configure at least one of: OAuth2 "
            f"(PHOENIX_OAUTH2_*) or LDAP ({ENV_PHOENIX_LDAP_HOST})."
        )
```

#### Complete Permutation Matrix

| Auth Enabled | Basic Disabled | OAuth2 | LDAP | Backend Result | Login Page Shows | Notes |
|:------------:|:--------------:|:------:|:----:|----------------|------------------|-------|
| ❌ `false` | - | - | - | ✅ Valid | Nothing | No authentication required |
| ✅ `true` | ❌ `false` | ❌ | ❌ | ✅ Valid | **LOCAL form** | Standard username/password |
| ✅ `true` | ❌ `false` | ✅ | ❌ | ✅ Valid | **LOCAL form** + "or" + **OAuth2 buttons** | Both methods available |
| ✅ `true` | ❌ `false` | ❌ | ✅ | ✅ Valid | **LOCAL form** + "or" + **LDAP form** | Both methods available |
| ✅ `true` | ❌ `false` | ✅ | ✅ | ✅ Valid | **LOCAL form** + "or" + **LDAP form** + "or" + **OAuth2 buttons** | All three methods<br>**Admin Dialog**: LOCAL + OAuth2 + LDAP tabs |
| ✅ `true` | ✅ `true` | ❌ | ❌ | ❌ **INVALID** | N/A | **Error**: "no alternative authentication methods are configured" |
| ✅ `true` | ✅ `true` | ✅ | ❌ | ✅ Valid | **OAuth2 buttons only** | OAuth2-only deployment<br>**Admin Dialog**: OAuth2 tab only |
| ✅ `true` | ✅ `true` | ❌ | ✅ | ✅ Valid | **LDAP form only** | LDAP-only deployment<br>**Admin Dialog**: LDAP tab only |
| ✅ `true` | ✅ `true` | ✅ | ✅ | ✅ Valid | **LDAP form** + "or" + **OAuth2 buttons** | Both external auth methods<br>**Admin Dialog**: OAuth2 + LDAP tabs only |

#### Frontend Rendering Logic (`LoginPage.tsx`)

```typescript
const showLoginForm = !window.Config.basicAuthDisabled;
const showLDAPForm = window.Config.ldapEnabled;
const hasOAuth2Idps = window.Config.oAuth2Idps.length > 0;
```

**Separator Logic**:
1. "or" between LOCAL and LDAP if both exist: `{showLoginForm ? <div>or</div> : null}`
2. "or" between (LOCAL OR LDAP) and OAuth2: `{(showLoginForm || showLDAPForm) && hasOAuth2Idps ? <div>or</div> : null}`

#### Admin User Creation Logic (`NewUserDialog.tsx`)

**Tab Visibility Logic**:
```typescript
const showLocalTab = !window.Config.basicAuthDisabled;
const showOAuth2Tab = window.Config.oAuth2Idps.length > 0;
const showLDAPTab = window.Config.ldapEnabled;
```

**Smart Default Tab Selection**:
```typescript
const defaultTab = showLocalTab
  ? "local"      // Prefer LOCAL if available
  : showOAuth2Tab
    ? "oauth2"   // Then OAuth2 if configured
    : showLDAPTab
      ? "ldap"   // Then LDAP if configured
      : "local"; // Fallback (should never happen)
```

**Tab Display Rules**:
- **LOCAL tab**: Shown only if `!basicAuthDisabled` (standard password auth allowed)
- **OAuth2 tab**: Shown only if `oAuth2Idps.length > 0` (at least one OAuth2 provider configured)
- **LDAP tab**: Shown only if `ldapEnabled` (LDAP is configured)

**Rationale**: Only show tabs for auth methods that are actually configured and usable, preventing admins from creating invalid users.

#### Security: Cross-Authentication Prevention

**Problem**: Users could have same email in different auth systems, creating security vulnerabilities:
- LDAP user with `alice@corp.com` → OAuth2 login hijacks account
- OAuth2 user with `bob@corp.com` → LDAP login creates duplicate

**Solution**:

1. **LDAP sign-up rejects an email owned by another method** (`get_or_create_ldap_user` in `routers/ldap.py`): before creating an `LDAPUser`, Phoenix looks up the email across all users. If the row's `auth_method` is not `LDAP`, the login fails with the generic 401.
2. **OAuth2 sign-in accepts only OAuth2 rows** (`routers/oauth2.py`): when the email lookup finds a user that is not an `OAuth2User`, sign-in fails with `SignInNotAllowed`.
3. **Password login accepts only LOCAL rows**: an LDAP or OAuth2 row has no password hash, so a password login cannot succeed.

**Error Messages**: Always generic to prevent username enumeration.

#### Key Design Principles

1. **Backend-First Validation**: Invalid configurations fail at startup, not runtime
2. **Secure Defaults**: `PHOENIX_DISABLE_BASIC_AUTH=true` requires alternative auth
3. **Graceful Degradation**: Frontend adapts to available auth methods
4. **No Username Enumeration**: Generic error messages across all scenarios
5. **Cross-Auth Security**: Each auth method is isolated, no account hijacking

#### Startup Admin Provisioning (`PHOENIX_ADMINS`)

When `PHOENIX_ADMINS` is configured, Phoenix automatically creates admin users at startup (`facilitator.py:_ensure_admins`):

| Condition | User Type Created |
|-----------|-------------------|
| `PHOENIX_DISABLE_BASIC_AUTH=false` | `LocalUser` (random password, must reset) |
| `PHOENIX_DISABLE_BASIC_AUTH=true` + LDAP configured (no OAuth2) | `LDAPUser` (email set, `ldap_unique_id` NULL) |
| `PHOENIX_DISABLE_BASIC_AUTH=true` + OAuth2 configured | `OAuth2User` (generic) |

On the user's first LDAP login, Phoenix finds the row by email. In enterprise mode, it then stores the user's unique ID in `ldap_unique_id` ([User Identification Strategy](./user-identification-strategy.md#admin-provisioned-users)). `PHOENIX_ADMINS` is rejected in null-email mode, because it creates users by email.

**Configuration Example**:
```bash
PHOENIX_ENABLE_AUTH=true
PHOENIX_DISABLE_BASIC_AUTH=true
PHOENIX_ADMINS="John Doe=john@example.com;Jane Smith=jane@example.com"
PHOENIX_LDAP_HOST=ldap.example.com
# ... other LDAP config
```
→ Creates `john@example.com` and `jane@example.com` as LDAP users at startup

#### Common Deployment Scenarios

**Scenario 1: Corporate Environment (LDAP + OAuth2)**
```bash
PHOENIX_ENABLE_AUTH=true
PHOENIX_DISABLE_BASIC_AUTH=true   # No password auth
PHOENIX_LDAP_HOST=ldap.corp.com
PHOENIX_OAUTH2_CLIENT_ID=...      # Google/Microsoft for external contractors
```
→ Login page shows LDAP form + OAuth2 buttons

**Scenario 2: Pure LDAP Deployment**
```bash
PHOENIX_ENABLE_AUTH=true
PHOENIX_DISABLE_BASIC_AUTH=true
PHOENIX_LDAP_HOST=ldap.corp.com
```
→ Login page shows LDAP form only

**Scenario 3: All Methods Available (Dev/Testing)**
```bash
PHOENIX_ENABLE_AUTH=true
# PHOENIX_DISABLE_BASIC_AUTH not set (defaults to false)
PHOENIX_LDAP_HOST=ldap.corp.com
PHOENIX_OAUTH2_CLIENT_ID=...
```
→ Login page shows LOCAL + LDAP + OAuth2

**Scenario 4: Auth Disabled (Local Development)**
```bash
# PHOENIX_ENABLE_AUTH not set (defaults to false)
```
→ No login page, no authentication required

#### Testing Coverage

**Backend Validation** (`tests/unit/test_config.py`):
- ✅ Valid configurations accepted
- ✅ Invalid configuration (basic disabled, no alternatives) raises `ValueError`
- ✅ LDAP config validation (host, search base, group mappings)

**Frontend Rendering** (Manual verification required):
- ✅ Correct forms shown for each permutation
- ✅ Separators placed correctly
- ✅ Default tab selection in admin dialog

**Cross-Auth Security** (`tests/integration/auth/test_ldap.py`):
- ✅ `test_ldap_user_cannot_login_via_oauth2`
- ✅ `test_ldap_login_rejected_when_oauth2_user_exists`

---

