# Future Improvements (Post-MVP)

This document catalogs potential enhancements to elevate the LDAP implementation from production-ready (A-) to enterprise-grade (A+). These are **not blockers** for the current release but represent opportunities for future iterations.

---

## Priority Matrix

| Feature | Impact | Complexity | Target Phase |
|---------|--------|------------|--------------|
| [Password Policy Handling](#1-password-policy-handling) | High | Medium | **Phase 2** |
| [Retry Logic](#2-retry-logic-for-transient-failures) | Medium | Low | **Phase 2** |
| [Metrics/Observability](#3-metricsobservability) | Medium | Low | **Phase 2** |
| [Nested Group Resolution](#4-nested-group-resolution-for-active-directory) | Medium | High | Phase 3 |
| [Connection Health Checks](#5-connection-health-checks) | Low | Medium | Phase 3 |
| [Group Search Pagination](#6-group-search-pagination) | Low | Low | As needed |

**Phase 2 Recommendation**: Items 1-3 should be bundled in the next LDAP release for significant UX and operational improvements with modest effort.

---

## 1. Password Policy Handling

**Impact**: High | **Complexity**: Medium | **Target**: Phase 2

### Current Behavior

All bind failures return generic "Invalid credentials" error.

### Problem

Active Directory and OpenLDAP return specific error codes for password-related issues that could provide better UX:

| AD Error Code | Meaning | Current UX | Ideal UX |
|---------------|---------|------------|----------|
| `data 532` | Password expired | "Invalid credentials" | "Password expired, contact admin" |
| `data 533` | Account disabled | "Invalid credentials" | "Account disabled" |
| `data 701` | Account expired | "Invalid credentials" | "Account expired" |
| `data 773` | Must change password | "Invalid credentials" | "Password change required" |
| `data 775` | Account locked | "Invalid credentials" | "Account locked, try later" |

### Implementation Sketch

```python
from enum import Enum

class LDAPAuthResult(Enum):
    """LDAP authentication result with account status details."""
    SUCCESS = "success"
    INVALID_CREDENTIALS = "invalid_credentials"
    PASSWORD_EXPIRED = "password_expired"
    ACCOUNT_DISABLED = "account_disabled"
    ACCOUNT_LOCKED = "account_locked"
    MUST_CHANGE_PASSWORD = "must_change_password"


def _verify_user_password(self, server, user_dn, password) -> LDAPAuthResult:
    """Verify password and detect account status issues.
    
    Parses Active Directory extended error information from bind failures
    to provide actionable feedback to users.
    
    AD Error Format:
        "80090308: LdapErr: DSID-0C09044E, comment: AcceptSecurityContext error, 
         data XXX, v23f0"
        
        Where XXX is the sub-status code (532, 533, 701, 773, 775, etc.)
    """
    try:
        # ... existing bind logic ...
        return LDAPAuthResult.SUCCESS
    except LDAPInvalidCredentialsResult as e:
        error_msg = str(e)
        
        # Parse AD sub-status codes
        if "data 532" in error_msg:
            return LDAPAuthResult.PASSWORD_EXPIRED
        elif "data 533" in error_msg:
            return LDAPAuthResult.ACCOUNT_DISABLED
        elif "data 701" in error_msg:
            # Account expired (different from password expired)
            return LDAPAuthResult.ACCOUNT_DISABLED
        elif "data 773" in error_msg:
            return LDAPAuthResult.MUST_CHANGE_PASSWORD
        elif "data 775" in error_msg:
            return LDAPAuthResult.ACCOUNT_LOCKED
        
        return LDAPAuthResult.INVALID_CREDENTIALS
```

### API Response Updates

```python
# In /auth/ldap/login endpoint
match auth_result:
    case LDAPAuthResult.SUCCESS:
        return create_tokens(user)
    case LDAPAuthResult.PASSWORD_EXPIRED:
        raise HTTPException(401, detail="Password has expired. Please contact your administrator.")
    case LDAPAuthResult.ACCOUNT_LOCKED:
        raise HTTPException(401, detail="Account is locked. Please try again later.")
    case LDAPAuthResult.MUST_CHANGE_PASSWORD:
        raise HTTPException(401, detail="Password change required. Please contact your administrator.")
    case _:
        raise HTTPException(401, detail="Invalid username and/or password")
```

### Security Considerations

- **Username Enumeration Risk**: Detailed errors confirm user existence. Consider only showing detailed errors after successful user lookup (which already confirms existence).
- **Information Disclosure**: Error messages should be generic enough to not aid attackers but specific enough to help legitimate users.

### References

- [MS-ADTS §3.1.1.3.4.2](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-adts/) - AD LDAP error codes
- [OpenLDAP ppolicy overlay](https://www.openldap.org/doc/admin24/overlays.html#Password%20Policies) - LDAP password policy controls

---

## 2. Retry Logic for Transient Failures

**Impact**: Medium | **Complexity**: Low | **Target**: Phase 2

### Current Behavior

A network blip mid-request fails the entire authentication attempt for that server, then moves to next server.

### Problem

Transient network issues (brief DNS hiccups, momentary packet loss) cause unnecessary failures and degrade user experience.

### Implementation Sketch

```python
from tenacity import (
    retry,
    stop_after_attempt,
    retry_if_exception_type,
    wait_fixed,
    before_sleep_log,
)
from ldap3.core.exceptions import LDAPSocketOpenError, LDAPSocketReceiveError

logger = logging.getLogger(__name__)


@retry(
    stop=stop_after_attempt(2),  # Original attempt + 1 retry
    wait=wait_fixed(0.5),         # 500ms between attempts
    retry=retry_if_exception_type((
        LDAPSocketOpenError,      # Connection refused, timeout
        LDAPSocketReceiveError,   # Connection reset mid-operation
    )),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
def _try_authenticate_on_server(
    self, 
    server: Server, 
    username: str, 
    password: str
) -> LDAPUserInfo | None:
    """Single server auth attempt with retry for transient network errors.
    
    Retry Policy:
        - Max 1 retry (2 total attempts)
        - 500ms delay between attempts
        - Only retries on socket-level errors (network issues)
    
    Does NOT retry on:
        - LDAPInvalidCredentialsResult (wrong password)
        - LDAPNoSuchObjectResult (user not found)
        - Other LDAP protocol errors (server-side issues)
    """
    with self._establish_connection(server) as conn:
        # ... existing authentication logic ...
        pass
```

### Metrics Integration

```python
# Track retry frequency for monitoring
ldap_retry_total = Counter(
    'phoenix_ldap_retry_total',
    'LDAP authentication retry attempts',
    ['server', 'error_type']
)

# In retry callback
def on_retry(retry_state):
    ldap_retry_total.labels(
        server=retry_state.args[1].host,  # server argument
        error_type=type(retry_state.outcome.exception()).__name__
    ).inc()
```

### Configuration Option (Optional)

```bash
# Environment variable to disable retries if needed
PHOENIX_LDAP_RETRY_ENABLED=true  # default
PHOENIX_LDAP_RETRY_MAX_ATTEMPTS=2
PHOENIX_LDAP_RETRY_DELAY_MS=500
```

---

## 3. Metrics/Observability

**Impact**: Medium | **Complexity**: Low | **Target**: Phase 2

### Current Behavior

No visibility into LDAP authentication performance or failure patterns.

### Problem

Operations teams cannot:
- Track LDAP auth latency trends
- Identify failing servers proactively
- Debug authentication issues without log diving
- Set up alerting for LDAP degradation

### Implementation Sketch

```python
from prometheus_client import Counter, Histogram, Gauge

# === Counters ===

ldap_auth_total = Counter(
    'phoenix_ldap_auth_total',
    'Total LDAP authentication attempts',
    ['result', 'server']
)
# Labels:
#   result: success, invalid_credentials, user_not_found, server_error, timeout, all_failed
#   server: hostname or "all" for aggregate failures

ldap_bind_total = Counter(
    'phoenix_ldap_bind_total',
    'Total LDAP bind operations (service account + user)',
    ['type', 'server', 'result']
)
# Labels:
#   type: service_account, user_verification, anonymous
#   result: success, failure

# === Histograms ===

ldap_auth_duration_seconds = Histogram(
    'phoenix_ldap_auth_duration_seconds',
    'LDAP authentication end-to-end latency',
    ['server'],
    buckets=[0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0]
)

ldap_operation_duration_seconds = Histogram(
    'phoenix_ldap_operation_duration_seconds',
    'Individual LDAP operation latency',
    ['operation', 'server'],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0]
)
# Labels:
#   operation: connect, bind, search_user, search_groups, verify_password

# === Gauges ===

ldap_server_healthy = Gauge(
    'phoenix_ldap_server_healthy',
    'LDAP server health status (1=healthy, 0=unhealthy)',
    ['server']
)

ldap_servers_configured = Gauge(
    'phoenix_ldap_servers_configured',
    'Number of configured LDAP servers'
)
```

### Usage in Code

```python
async def authenticate(self, username: str, password: str) -> LDAPUserInfo | None:
    """Authenticate with metrics instrumentation."""
    for server in self.servers:
        with ldap_auth_duration_seconds.labels(server=server.host).time():
            try:
                result = await self._authenticate_on_server(server, username, password)
                if result:
                    ldap_auth_total.labels(result='success', server=server.host).inc()
                    return result
                else:
                    ldap_auth_total.labels(result='invalid_credentials', server=server.host).inc()
                    return None
            except LDAPException as e:
                ldap_auth_total.labels(result='server_error', server=server.host).inc()
                continue
    
    ldap_auth_total.labels(result='all_failed', server='all').inc()
    return None
```

### Grafana Dashboard (Future)

Consider shipping a pre-built Grafana dashboard JSON for LDAP monitoring:
- Authentication success/failure rates
- Latency percentiles (P50, P95, P99)
- Server health status
- Error type breakdown

---

## 4. Nested Group Resolution for Active Directory

**Impact**: Medium | **Complexity**: High | **Target**: Phase 3 (customer-driven)

### Current Behavior

Only direct group memberships are resolved via `memberOf` attribute.

### Problem

Many AD deployments use nested groups:
```
Phoenix Admins (group)
  └── IT Admins (group)        ← Nested group
        └── alice (user)       ← Indirect member of "Phoenix Admins"
```

Current implementation won't see Alice as a member of "Phoenix Admins".

### Option A: LDAP_MATCHING_RULE_IN_CHAIN (Recommended)

```python
def _get_nested_groups_ad(self, conn: Connection, user_dn: str) -> list[str]:
    """Resolve nested AD groups using recursive membership filter.
    
    Uses Microsoft's LDAP_MATCHING_RULE_IN_CHAIN (OID 1.2.840.113556.1.4.1941)
    which recursively expands group membership server-side.
    
    Performance: Single LDAP query, server does recursion
    Compatibility: AD-only (not OpenLDAP)
    
    Args:
        conn: Active LDAP connection
        user_dn: User's distinguished name
        
    Returns:
        List of all group DNs (direct + transitive)
    """
    # OID 1.2.840.113556.1.4.1941 = LDAP_MATCHING_RULE_IN_CHAIN
    # Finds all groups where user_dn is a member (directly or transitively)
    nested_filter = f"(member:1.2.840.113556.1.4.1941:={escape_filter_chars(user_dn)})"
    
    conn.search(
        search_base=self.config.group_search_base_dns[0],
        search_filter=nested_filter,
        search_scope=SUBTREE,
        attributes=['distinguishedName'],
    )
    
    return [entry.entry_dn for entry in conn.entries]
```

### Option B: tokenGroups Attribute

```python
def _get_nested_groups_via_token_groups(self, conn: Connection, user_dn: str) -> list[str]:
    """Resolve nested groups via AD's tokenGroups attribute.
    
    tokenGroups contains binary SIDs of all groups (including nested).
    Requires additional lookup to convert SIDs to DNs.
    
    Performance: Two queries (get SIDs, resolve to DNs)
    Compatibility: AD-only
    
    Pros:
        - Returns security groups only (no distribution lists)
        - Includes domain-local groups from trusts
        
    Cons:
        - Binary SID handling complexity
        - Requires SID-to-DN resolution query
    """
    # Step 1: Get tokenGroups (binary SIDs)
    conn.search(
        search_base=user_dn,
        search_filter='(objectClass=*)',
        search_scope=BASE,
        attributes=['tokenGroups'],
    )
    
    if not conn.entries:
        return []
    
    sids = conn.entries[0].tokenGroups.raw_values
    
    # Step 2: Resolve SIDs to DNs
    groups = []
    for sid in sids:
        sid_string = self._binary_sid_to_string(sid)
        conn.search(
            search_base=self.config.user_search_base_dns[0],
            search_filter=f'(objectSid={sid_string})',
            search_scope=SUBTREE,
            attributes=['distinguishedName'],
        )
        if conn.entries:
            groups.append(conn.entries[0].entry_dn)
    
    return groups
```

### Configuration

```bash
# Enable nested group resolution (default: false for backward compatibility)
PHOENIX_LDAP_NESTED_GROUPS=true

# Method selection (if multiple supported in future)
PHOENIX_LDAP_NESTED_GROUPS_METHOD=chain  # or "tokengroups"
```

### References

- [MS-ADTS LDAP_MATCHING_RULE_IN_CHAIN](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-adts/)
- [tokenGroups attribute](https://docs.microsoft.com/en-us/windows/win32/adschema/a-tokengroups)
- [SID structure (MS-DTYP)](https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-dtyp/)

---

## 5. Connection Health Checks

**Impact**: Low | **Complexity**: Medium | **Target**: Phase 3

### Current Behavior

Failed servers are discovered at authentication time.

### Problem

First user to hit a failed server experiences latency while failover occurs. No proactive alerting for server issues.

### Implementation Sketch

```python
import asyncio
from typing import Optional


class LDAPAuthenticator:
    def __init__(self, config: LDAPConfig):
        self.servers = self._create_servers()
        self._healthy_servers: list[Server] = list(self.servers)
        self._health_check_task: Optional[asyncio.Task] = None
    
    async def start_health_checks(self, interval: float = 30.0) -> None:
        """Background task to check server health.
        
        Performs lightweight anonymous bind or rootDSE query to verify connectivity.
        Updates _healthy_servers list for prioritized failover.
        
        Args:
            interval: Seconds between health check cycles
        """
        logger.info(f"Starting LDAP health checks (interval={interval}s)")
        
        while True:
            await asyncio.sleep(interval)
            
            for server in self.servers:
                healthy = await self._check_server_health(server)
                
                if healthy and server not in self._healthy_servers:
                    self._healthy_servers.append(server)
                    logger.info(f"LDAP server {server.host} recovered")
                    ldap_server_healthy.labels(server=server.host).set(1)
                    
                elif not healthy and server in self._healthy_servers:
                    self._healthy_servers.remove(server)
                    logger.warning(f"LDAP server {server.host} is unhealthy")
                    ldap_server_healthy.labels(server=server.host).set(0)
    
    async def _check_server_health(self, server: Server) -> bool:
        """Quick connectivity check via rootDSE query.
        
        RootDSE is always accessible without authentication and returns
        server capabilities. Faster than bind operations.
        """
        try:
            conn = Connection(
                server,
                auto_bind=False,
                receive_timeout=5,  # Short timeout for health checks
            )
            conn.open()
            
            # Query rootDSE (always accessible)
            conn.search(
                search_base='',
                search_filter='(objectClass=*)',
                search_scope=BASE,
                attributes=['namingContexts'],
            )
            
            conn.unbind()
            return True
            
        except LDAPException:
            return False
    
    async def stop_health_checks(self) -> None:
        """Stop background health check task."""
        if self._health_check_task:
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass
            self._health_check_task = None
    
    async def authenticate(self, username: str, password: str) -> LDAPUserInfo | None:
        """Authenticate with health-aware server selection."""
        # Prioritize healthy servers, fall back to all servers if none healthy
        servers_to_try = self._healthy_servers if self._healthy_servers else self.servers
        
        for server in servers_to_try:
            try:
                result = await self._authenticate_on_server(server, username, password)
                if result:
                    return result
            except LDAPException:
                continue
        
        return None
```

### FastAPI Lifespan Integration

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    if ldap_config := get_ldap_config():
        authenticator = LDAPAuthenticator(ldap_config)
        authenticator._health_check_task = asyncio.create_task(
            authenticator.start_health_checks()
        )
        app.state.ldap_authenticator = authenticator
    
    yield
    
    # Shutdown
    if hasattr(app.state, 'ldap_authenticator'):
        await app.state.ldap_authenticator.stop_health_checks()
```

---

## 6. Group Search Pagination

**Impact**: Low | **Complexity**: Low | **Target**: As needed

### Current Behavior

POSIX mode group searches use single unpaginated query.

### Problem

LDAP servers typically limit results to 1000 entries (configurable). Organizations with >1000 groups in a search base may get truncated results.

### Implementation Sketch

```python
from ldap3.extend.standard import paged_search


def _search_groups_paged(
    self,
    conn: Connection,
    search_base: str,
    search_filter: str,
    page_size: int = 500
) -> list[str]:
    """Search groups with pagination for large directories.
    
    Uses LDAP Simple Paged Results Control (RFC 2696) to handle
    directories with more than 1000 groups.
    
    Args:
        conn: Active LDAP connection
        search_base: Base DN for group search
        search_filter: LDAP filter for group membership
        page_size: Results per page (default 500)
        
    Returns:
        List of all matching group DNs
    """
    groups = []
    
    generator = paged_search.paged_search_generator(
        conn,
        search_base=search_base,
        search_filter=search_filter,
        search_scope=SUBTREE,
        attributes=['distinguishedName'],
        paged_size=page_size,
    )
    
    for entry in generator:
        if entry['type'] == 'searchResEntry':
            groups.append(entry['dn'])
    
    logger.debug(f"Paged search returned {len(groups)} groups from {search_base}")
    return groups
```

### When to Implement

Only implement if a customer reports truncation issues. Signs of this problem:
- Users missing expected role assignments
- Log messages about partial results
- Large enterprise with >1000 LDAP groups

### References

- [RFC 2696](https://www.rfc-editor.org/rfc/rfc2696) - LDAP Simple Paged Results Control

---

## Implementation Recommendations

### Phase 2 (Next LDAP Release)

Bundle these three improvements for significant operational value:

1. ✅ **Metrics/Observability** - Low effort, essential for production operations
2. ✅ **Retry Logic** - Low effort, improves reliability
3. ⚠️ **Password Policy Handling** - Medium effort, major UX improvement

**Estimated Effort**: 2-3 days total

### Phase 3 (Future)

Implement based on customer demand:

4. ⏳ **Nested Group Resolution** - Only if customers report AD nested group issues
5. ⏳ **Connection Health Checks** - Only for large multi-server deployments
6. ⏳ **Group Search Pagination** - Only if truncation reported

### Not Recommended

- **Connection Pooling**: Complexity vs. benefit tradeoff unfavorable for typical Phoenix workloads (<100 auth/sec). Each auth takes <500ms; pool management overhead may exceed connection setup cost.

---

## Related Documentation

- [Main LDAP Spec](../ldap-authentication.md) - Implementation overview
- [Security Deep-Dive](./security.md) - Current security measures
- [Configuration Reference](./configuration.md) - Environment variables
- [Protocol Compliance](./protocol-compliance.md) - RFC compliance details
