# Security Deep-Dive

## Threat Model

| Threat | Attack Vector | Impact | Likelihood | Mitigation |
|--------|---------------|--------|-----------|------------|
| **LDAP Injection** | Malicious input in username field | Unauthorized access, data leak | Medium | Input escaping, parameterized filters |
| **Credential Exposure** | Logs, network sniffing | Account compromise | Medium | TLS encryption, credential sanitization |
| **Timing Attacks** | Measure response times | Username enumeration | Low | Dummy bind on user-not-found, generic errors |
| **Brute Force** | Automated login attempts | Account compromise | High | Rate limiting, account lockout |
| **MITM** | Network interception | Credential theft | Medium | TLS with cert validation |
| **Event Loop DoS** | Slow LDAP connections | Service unavailability | Medium | Thread pool isolation, timeouts |
| **Regex DoS** | CVE-2024-47764 in python-ldap | Service degradation | Very Low | Use ldap3 (not python-ldap) |
| **Misconfiguration** | Wrong group mappings | Privilege escalation | Medium | Validation on startup, dry-run mode |

---

## LDAP Injection Prevention

**Attack Example**:
```python
# Vulnerable code (DON'T DO THIS):
username = request.username  # User input: "admin)(uid=*"
filter_str = f"(&(objectClass=user)(uid={username}))"
# Result: (&(objectClass=user)(uid=admin)(uid=*))
# Attacker bypasses authentication!
```

**Mitigation**:
```python
from ldap3.utils.conv import escape_filter_chars

# Safe usage (Phoenix implementation):
username = escape_filter_chars(request.username)
filter_str = f"(&(objectClass=user)(uid={username}))"
```

**Escaping Rules (RFC 4515)**:
- `\` → `\5c`
- `*` → `\2a`
- `(` → `\28`
- `)` → `\29`
- `\x00` → `\00`

**Test Cases**:
```python
from ldap3.utils.conv import escape_filter_chars

def test_ldap_injection_prevention():
    # Test special characters
    assert escape_filter_chars("admin)(uid=*") == "admin\\29\\28uid=\\2a"
    assert escape_filter_chars("user\\admin") == "user\\5cadmin"
    
    # Test null byte
    assert escape_filter_chars("user\x00admin") == "user\\00admin"
```

**Implementation**: Phoenix uses `ldap3.utils.conv.escape_filter_chars()` directly for RFC 4515-compliant escaping. See `src/phoenix/server/ldap.py`.

---

## Timing Attack Prevention

**Attack**: Attacker measures response times to determine if username exists.

**Attack Scenario**:
1. Attacker sends login request with "admin" / "wrongpass"
2. If "admin" exists: search succeeds → bind attempted → ~150ms response
3. If "admin" doesn't exist: search fails → immediate return → ~50ms response
4. Attacker measures response times to enumerate valid usernames

**Vulnerable Code**:
```python
# DON'T DO THIS:
user_dn = search_user(username)
if not user_dn:
    return {"error": "User not found"}  # Fast response (no bind attempt)
    
if not authenticate(user_dn, password):
    return {"error": "Invalid password"}  # Slow response (LDAP bind attempt)
```

**Mitigation** (Phoenix implementation):
```python
# Phoenix performs a dummy bind when user is not found to equalize timing
def _dummy_bind_for_timing(self, server: Server, password: str) -> None:
    """Perform a dummy bind to equalize response timing when user is not found."""
    # Randomized DN prevents LDAP server caching/optimization
    dummy_dn = f"cn=dummy-{token_hex(8)},dc=invalid,dc=local"
    try:
        self._verify_user_password(server, dummy_dn, password)
    except Exception:
        pass  # Expected to fail - we only care about the timing

def _authenticate(self, username: str, password: str) -> Optional[LDAPUserInfo]:
    # ... search for user ...
    user_entry = self._search_user(conn, escaped_username)
    if not user_entry:
        # TIMING ATTACK MITIGATION: Perform dummy bind to prevent username enumeration
        # Both "user not found" and "wrong password" now perform the same network I/O
        self._dummy_bind_for_timing(server, password)
        return None
    
    # User found - verify password as normal
    if not self._verify_user_password(server, user_dn, password):
        return None
```

**Why Dummy Bind (Not Sleep)**:
- `asyncio.sleep()` is predictable and doesn't account for network variance
- A real bind attempt has variable latency (TLS handshake, network RTT, server load)
- Dummy bind performs identical I/O operations, making timing indistinguishable
- Randomized DN (`token_hex(8)`) prevents LDAP server from caching/optimizing the response

**Result**: Both code paths (user exists vs. not found) perform search + bind operations, making response times statistically indistinguishable

---

## Rate Limiting

**Implementation** (Phoenix uses a custom `ServerRateLimiter`):
```python
from phoenix.server.rate_limiters import ServerRateLimiter, fastapi_ip_rate_limiter

# Configure rate limiter (0.2 req/sec = ~12 req/min per IP)
rate_limiter = ServerRateLimiter(
    per_second_rate_limit=0.2,
    enforcement_window_seconds=60,
    partition_seconds=60,
    active_partitions=2,
)

# Apply to authentication endpoints
login_rate_limiter = fastapi_ip_rate_limiter(
    rate_limiter,
    paths=[
        "/auth/login",
        "/auth/ldap/login",
        "/auth/logout",
        "/auth/refresh",
        "/auth/password-reset-email",
        "/auth/password-reset",
    ],
)

# Add as router dependency (can be disabled via PHOENIX_DISABLE_RATE_LIMIT)
auth_dependencies = [Depends(login_rate_limiter)] if not get_env_disable_rate_limit() else []
router = APIRouter(prefix="/auth", dependencies=auth_dependencies)
```

**Account Lockout** (future enhancement, not yet implemented):
```python
# Track failed attempts per username
failed_attempts = {}  # In production: use Redis

if failed_attempts.get(username, 0) >= 5:
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Account temporarily locked"
    )

# Increment on failure
if not success:
    failed_attempts[username] = failed_attempts.get(username, 0) + 1
```

---

## TLS Configuration

**Phoenix TLS Implementation** (see `_create_servers()` in `ldap.py`):
```python
# Certificate validation configuration
tls_kwargs: dict[str, Any] = {
    "validate": ssl.CERT_REQUIRED if config.tls_verify else ssl.CERT_NONE
}

# Custom CA certificate for private/internal CAs
if config.tls_ca_cert_file:
    tls_kwargs["ca_certs_file"] = config.tls_ca_cert_file

# Client certificate for mutual TLS (mTLS)
if config.tls_client_cert_file and config.tls_client_key_file:
    tls_kwargs["local_certificate_file"] = config.tls_client_cert_file
    tls_kwargs["local_private_key_file"] = config.tls_client_key_file

tls_config = Tls(**tls_kwargs)
```

**Recommendation**: Enable TLS (`PHOENIX_LDAP_USE_TLS=true`) and certificate validation
(`PHOENIX_LDAP_TLS_VERIFY=true`) in production environments to prevent credential interception.

**STARTTLS Security**: See [Protocol Compliance - STARTTLS Implementation](./protocol-compliance.md#7-starttls-implementation--security) for critical sequencing requirements and adversarial testing methodology.

---

## Logging

**MVP Approach**: Error-only logging for operational debugging, zero PII.

**Events Logged** (actual implementation in `ldap.py`):
```python
# Empty credentials rejected (warning - security event)
logger.warning("LDAP authentication rejected: empty username")
logger.warning("LDAP authentication rejected: empty password")

# Server failure (warning - includes only error type, not details)
logger.warning(
    f"LDAP server {server.host} failed during authentication. "
    f"Error type: {type(e).__name__}"
)

# All servers exhausted (error)
logger.error("All LDAP servers failed")

# Configuration/schema issues (error)
logger.error(
    f"LDAP user missing required email attribute "
    f"({config.attr_email}). Check LDAP schema configuration."
)
logger.error(
    f"Ambiguous LDAP search: found {len(conn.entries)} matching entries. "
    f"Rejecting authentication for safety. ..."
)

# Debug-level (not shown in production logs by default)
logger.debug("User not found in LDAP directory")
logger.debug("LDAP password verification failed")
```

**Rationale**: Only log errors administrators need to debug operational issues (server connectivity, TLS problems, misconfigurations). No success/failure logging to avoid PII complexity.

**DO NOT Log**:
- ❌ Usernames (PII)
- ❌ Passwords (never log credentials)
- ❌ Bind DN passwords (service account credentials)
- ❌ Email addresses (PII)
- ❌ Group DNs (PII, reveals org structure)
- ❌ User-specific failures (e.g., "invalid credentials for user X")
- ❌ Successful authentications

**Future Enhancement**: Add opt-in security audit logging with username hashing, PII controls, retention policies, and compliance documentation (GDPR, SOC2) post-MVP.

---

## Event Loop DoS Prevention

**Threat**: LDAP operations are network-bound and can block the FastAPI event loop if not properly isolated.

**Attack Scenario**:
```
1. Attacker opens multiple slow LDAP connections
2. Each connection blocks an async worker thread
3. Legitimate requests queue up (503 Service Unavailable)
4. Service degradation even with rate limiting
```

**Root Cause**: The `ldap3` library is synchronous-only. All operations (connection, TLS handshake, bind, search) block the calling thread.

**Mitigation**:
```python
# Phoenix implementation: Thread pool isolation
async def authenticate(self, username: str, password: str) -> Optional[LDAPUserInfo]:
    # Timeout prevents HTTP request hang, but thread continues until socket timeout
    with anyio.fail_after(60):
        return await anyio.to_thread.run_sync(self._authenticate, username, password)

def _authenticate(self, username: str, password: str) -> Optional[LDAPUserInfo]:
    # Socket-level timeout is the real enforcement mechanism
    conn = Connection(server, receive_timeout=30, ...)
```

**Benefits**:
- ✅ Main event loop remains responsive during LDAP operations
- ✅ Slow LDAP servers don't starve FastAPI workers
- ✅ Multiple concurrent LDAP authentications don't block each other
- ✅ Standard pattern for wrapping synchronous I/O in async frameworks

**Timeout Enforcement**:
- **Real timeout**: `receive_timeout=30` (socket-level, terminates blocking operations)
- **HTTP timeout**: `fail_after(60)` (prevents client hang, returns 500 error)
- **Limitation**: Threads cannot be cancelled from outside (Python limitation)
- **Result**: If socket timeout fails, thread becomes orphaned until natural completion

**Why Not ldap3.ASYNC**:
The `ldap3` library offers an `ASYNC` strategy, but it is not compatible with Python's `asyncio`:
- Uses background threads (not asyncio tasks)
- Still performs blocking socket operations
- Pre-dates Python's async/await (2013-era design)

Thread pool isolation via `anyio.to_thread.run_sync()` is the standard approach for integrating synchronous LDAP libraries with async frameworks.

---

## Socket Leak Prevention

**Threat**: Failed LDAP operations can leak file descriptors if connections are not properly cleaned up.

**Vulnerability**: Connection cleanup code that only runs conditionally can leave sockets open:
```python
# VULNERABLE: Socket leak on bind failure
try:
    conn.open()
    conn.start_tls()
    conn.bind()
    return conn.bound
finally:
    if conn.bound:  # ← Only runs if bind() succeeded!
        conn.unbind()
```

**Leak Scenarios**:
1. `conn.open()` raises → socket opened, cleanup skipped → **LEAK**
2. `conn.start_tls()` raises → socket opened, cleanup skipped → **LEAK**
3. `conn.bind()` raises → socket opened, cleanup skipped → **LEAK**
4. Wrong password → `conn.bound = False` → cleanup skipped → **LEAK**

**Impact**: Repeated failed logins exhaust file descriptors → process crash

**Mitigation**:
```python
# Phoenix implementation: Unconditional cleanup
try:
    conn.open()
    conn.start_tls()
    conn.bind()
    return conn.bound
finally:
    # CRITICAL: Always unbind to close socket, regardless of bind state
    conn.unbind()  # Closes socket even if connection not bound
```

**Key Insight**: `ldap3.Connection.unbind()` safely closes the underlying socket regardless of connection state. It can be called even if:
- `open()` never succeeded
- `start_tls()` failed mid-handshake
- `bind()` was never attempted
- Password verification failed

**Test Coverage**: Unit tests verify socket cleanup for:
- Bind failures (wrong password)
- `open()` exceptions
- `start_tls()` exceptions
- Anonymous bind with TLS failures

---

## Additional Security Resources

- [Protocol Compliance](./protocol-compliance.md) - Anonymous bind prevention, ambiguous search rejection, DN validation
- [Configuration Reference](./configuration.md) - TLS configuration options and security recommendations
- [Grafana Comparison](./grafana-comparison.md) - Security patterns adopted from Grafana's implementation

