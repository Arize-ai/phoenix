# Integration with Existing Phoenix Configuration

**Critical**: LDAP must integrate with Phoenix's existing authentication system in `src/phoenix/config.py`.

#### Current Authentication Configuration

**Existing `AuthSettings` NamedTuple** (`config.py:836-841`):
```python
class AuthSettings(NamedTuple):
    enable_auth: bool
    disable_basic_auth: bool
    phoenix_secret: Secret
    phoenix_admin_secret: Secret
    oauth2_clients: OAuth2Clients
```

**Existing Validation Logic** (`config.py:844-870`):
```python
def get_env_auth_settings() -> AuthSettings:
    enable_auth = get_env_enable_auth()
    phoenix_secret = get_env_phoenix_secret()
    
    # Validation: Secret required when auth enabled
    if enable_auth and not phoenix_secret:
        raise ValueError(
            f"`{ENV_PHOENIX_SECRET}` must be set when "
            f"auth is enabled with `{ENV_PHOENIX_ENABLE_AUTH}`"
        )
    
    disable_basic_auth = get_env_disable_basic_auth()
    oauth2_clients = OAuth2Clients.from_configs(get_env_oauth2_settings())
    
    # ⚠️ CRITICAL VALIDATION: If basic auth disabled, must have alternative
    if enable_auth and disable_basic_auth and not oauth2_clients:
        raise ValueError(
            "OAuth2 is the only supported auth method but no OAuth2 client configs are provided."
        )
    
    return AuthSettings(...)
```

#### Required Changes for LDAP Integration

**1. Update `AuthSettings` NamedTuple**:

```python
class AuthSettings(NamedTuple):
    enable_auth: bool
    disable_basic_auth: bool
    phoenix_secret: Secret
    phoenix_admin_secret: Secret
    oauth2_clients: OAuth2Clients
    ldap_config: Optional[LDAPConfig]  # ✅ ADD THIS
```

**2. Add LDAP Config Loader**:

```python
def get_env_ldap_config() -> Optional[LDAPConfig]:
    """Load LDAP configuration from environment variables.
    
    Returns:
        Optional[LDAPConfig]: LDAP configuration if PHOENIX_LDAP_HOST is set, None otherwise
    
    Raises:
        ValueError: If LDAP configuration is invalid
    """
    return LDAPConfig.from_env()
```

**3. Update Validation Logic in `get_env_auth_settings()`**:

```python
def get_env_auth_settings() -> AuthSettings:
    enable_auth = get_env_enable_auth()
    phoenix_secret = get_env_phoenix_secret()
    
    if enable_auth and not phoenix_secret:
        raise ValueError(
            f"`{ENV_PHOENIX_SECRET}` must be set when "
            f"auth is enabled with `{ENV_PHOENIX_ENABLE_AUTH}`"
        )
    
    phoenix_admin_secret = get_env_phoenix_admin_secret()
    disable_basic_auth = get_env_disable_basic_auth()
    
    oauth2_clients = OAuth2Clients.from_configs(get_env_oauth2_settings())
    ldap_config = get_env_ldap_config()  # ✅ ADD THIS
    
    # ✅ UPDATED VALIDATION: Check for LDAP or OAuth2 as alternative
    if enable_auth and disable_basic_auth and not oauth2_clients and not ldap_config:
        raise ValueError(
            "PHOENIX_DISABLE_BASIC_AUTH is set, but no alternative authentication methods "
            "are configured. Please configure at least one of: OAuth2 "
            "(PHOENIX_OAUTH2_*) or LDAP (PHOENIX_LDAP_*)."
        )
    
    return AuthSettings(
        enable_auth=enable_auth,
        disable_basic_auth=disable_basic_auth,
        phoenix_secret=phoenix_secret,
        phoenix_admin_secret=phoenix_admin_secret,
        oauth2_clients=oauth2_clients,
        ldap_config=ldap_config,  # ✅ ADD THIS
    )
```

**4. Update `create_app()` Signature** (`server/app.py:968`):

```python
def create_app(
    db: DbSessionFactory,
    export_path: Path,
    model: Model,
    authentication_enabled: bool,
    # ... existing params ...
    oauth2_client_configs: Optional[list[OAuth2ClientConfig]] = None,
    ldap_config: Optional[LDAPConfig] = None,  # ✅ ADD THIS
    basic_auth_disabled: bool = False,
    # ... rest
) -> FastAPI:
```

**5. Update `main()` to Pass LDAP Config** (`server/main.py:458`):

```python
app = create_app(
    db=factory,
    # ... existing params ...
    oauth2_client_configs=get_env_oauth2_settings(),
    ldap_config=auth_settings.ldap_config,  # ✅ ADD THIS
    allowed_origins=allowed_origins,
    management_url=management_url,
)
```

**6. Store LDAP Config in App State** (`server/app.py`):

```python
# Store LDAP config in app state for routers to access
if ldap_config:
    app.state.ldap_config = ldap_config
```

#### Environment Variable Interactions

| Scenario | Behavior | Validation |
|----------|----------|------------|
| `ENABLE_AUTH=false` | ✅ LDAP config ignored (no auth needed) | No validation |
| `ENABLE_AUTH=true` + no `PHOENIX_SECRET` | ❌ Error: Secret required | Existing validation |
| `ENABLE_AUTH=true` + `DISABLE_BASIC_AUTH=true` + no OAuth2 + no LDAP | ❌ Error: No auth methods available | ✅ **NEW** validation |
| `ENABLE_AUTH=true` + `DISABLE_BASIC_AUTH=true` + LDAP configured | ✅ LDAP-only auth | ✅ **NEW** validation |
| `ENABLE_AUTH=true` + `DISABLE_BASIC_AUTH=true` + OAuth2 + LDAP | ✅ OAuth2 + LDAP (no basic) | ✅ **NEW** validation |
| `ENABLE_AUTH=true` + `DISABLE_BASIC_AUTH=false` + LDAP | ✅ Basic + LDAP coexist | Works by default |
| `PHOENIX_LDAP_HOST` set + malformed JSON in `GROUP_ROLE_MAPPINGS` | ❌ Error: Invalid JSON | ✅ Validated in `LDAPConfig.from_env()` |

#### `/auth/login` Endpoint Interaction

**Current Code** (`server/api/routers/auth.py:67-70`):
```python
@router.post("/login")
async def login(request: Request) -> Response:
    if get_env_disable_basic_auth():  # ⚠️ Blocks basic auth
        raise HTTPException(status_code=403)
    # ... password validation ...
```

**No Change Needed**: LDAP will have its own endpoint (`/auth/ldap/login`), so this check is correct.

#### CSRF Protection Interaction

**Current Warning** (`server/app.py:1034-1040`):
```python
elif email_sender or oauth2_client_configs:
    logger.warning(
        "CSRF protection can be enabled by listing trusted origins via "
        f"the `{ENV_PHOENIX_CSRF_TRUSTED_ORIGINS}` environment variable. "
        "This is recommended when setting up OAuth2 clients or sending "
        "password reset emails."
    )
```

**Update Required**:
```python
elif email_sender or oauth2_client_configs or ldap_config:  # ✅ ADD ldap_config
    logger.warning(
        "CSRF protection can be enabled by listing trusted origins via "
        f"the `{ENV_PHOENIX_CSRF_TRUSTED_ORIGINS}` environment variable. "
        "This is recommended when setting up OAuth2 clients, LDAP, or sending "
        "password reset emails."
    )
```

#### Rate Limiting

**Current**: `/auth/login` is rate-limited (`server/api/routers/auth.py:52-61`)

**LDAP**: New `/auth/ldap/login` endpoint must be added to rate-limited paths:
```python
login_rate_limiter = fastapi_ip_rate_limiter(
    rate_limiter,
    paths=[
        "/auth/login",
        "/auth/ldap/login",  # ✅ ADD THIS
        "/auth/logout",
        "/auth/refresh",
        "/auth/password-reset-email",
        "/auth/password-reset",
    ],
)
```

#### Summary of Changes Needed

| File | Change | Impact |
|------|--------|--------|
| `src/phoenix/config.py` | Add `ldap_config: Optional[LDAPConfig]` to `AuthSettings` | ONE-WAY door (NamedTuple field order) |
| `src/phoenix/config.py` | Update `get_env_auth_settings()` validation | Allows LDAP as auth alternative |
| `src/phoenix/config.py` | Add `get_env_ldap_config()` function | New function |
| `src/phoenix/server/app.py` | Add `ldap_config` parameter to `create_app()` | Signature change |
| `src/phoenix/server/app.py` | Update CSRF warning to include LDAP | Warning message |
| `src/phoenix/server/app.py` | Store `ldap_config` in `app.state` | New state |
| `src/phoenix/server/main.py` | Pass `ldap_config=auth_settings.ldap_config` | Call site |
| `src/phoenix/server/api/routers/auth.py` | Add `/auth/ldap/login` to rate limiter paths | Rate limiting |

**All changes are backward compatible** - LDAP is optional, existing OAuth2/basic auth continue to work unchanged.

---

### Phase 1: Core LDAP Authentication
