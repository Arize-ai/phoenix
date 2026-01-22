"""LDAP authentication for Phoenix.

Provides LDAP/Active Directory authentication following RFC 4510-4519 standards.

TLS Connection Modes:
    LDAP supports three connection security modes:

    1. LDAPS (LDAP over TLS, port 636):
        - TLS established at TCP connection layer (like HTTPS)
        - Server created with use_ssl=True
        - Bind credentials encrypted from the start
        - No protocol-level upgrade needed

    2. STARTTLS (Upgrade to TLS, port 389):
        - Connection starts as plaintext on standard LDAP port
        - Client sends Extended Request (OID 1.3.6.1.4.1.1466.20037) to upgrade
        - Server upgrades connection to TLS
        - All subsequent data (including bind) encrypted
        - CRITICAL: Must call start_tls() BEFORE sending credentials

    3. Plaintext (No encryption, testing only):
        - All data transmitted unencrypted
        - Not recommended for production

Advanced TLS Configuration:
    Phoenix supports enterprise TLS requirements via optional configuration:

    - Custom CA Certificates (tls_ca_cert_file):
        For LDAP servers using private/internal certificate authorities
        not present in the system's default trust store.

    - Client Certificates (tls_client_cert_file, tls_client_key_file):
        For mutual TLS (mTLS) authentication where the LDAP server
        requires client certificate validation.

Security Considerations:
    This module implements multiple layers of defense against LDAP-specific attacks:

    - Anonymous Bind Prevention (RFC 4513 §5.1.2):
        Empty passwords are rejected before any LDAP operation. Many LDAP servers
        treat empty-password binds as "unauthenticated" (anonymous), which would
        allow attackers to bypass authentication entirely.

    - LDAP Injection Prevention (RFC 4515):
        All user input is escaped before insertion into LDAP filters using
        escape_filter_chars(). This prevents filter manipulation attacks like
        username="*" or "admin)(uid=*".

    - Referral Following Disabled:
        ldap3 defaults to auto_referrals=True, which follows LDAP referrals to
        ANY server and sends bind credentials automatically. An attacker who can
        inject a referral response could steal service account credentials.
        Phoenix disables this (auto_referrals=False) and relies on explicit
        multi-server configuration for high availability instead.

    - Timing Attack Mitigation:
        When a user is not found, a dummy bind is performed to equalize response
        times with the "wrong password" case, preventing username enumeration.

    - Exception Sanitization:
        LDAP exception messages may contain sensitive information (server IPs,
        DNs, configuration details). Only the exception type is logged.

Implementation Notes:
    The ldap3 library requires explicit handling of STARTTLS via:
        - AUTO_BIND_TLS_BEFORE_BIND constant for automatic bind flows
        - Manual start_tls() call for explicit bind flows

    Using auto_bind=True (AUTO_BIND_NO_TLS) with STARTTLS configuration
    will transmit credentials in PLAINTEXT despite TLS being "enabled".
    This is a critical security vulnerability that this module guards against.

Thread Safety Note:
    This implementation uses ldap3's default SYNC strategy (not SAFE_SYNC) because
    Connection objects are created fresh for each authentication request and never
    shared between threads. The SAFE_SYNC strategy would only be required if we
    introduced connection pooling or reused Connection objects across requests.
    Server objects ARE thread-safe (ldap3 uses internal locking for message IDs).

    Note: ldap3's "ASYNC" strategy uses OS threads, NOT Python async/await coroutines.
    The library has no native asyncio support—all strategies perform blocking socket I/O.
    We therefore run ldap3 in a thread pool via anyio.to_thread.run_sync() to avoid
    blocking the FastAPI event loop (see authenticate() docstring for details).

Known Limitations:
    - No connection pooling: Each authentication creates fresh connections.
      For very high-volume deployments (>100 auth/sec), consider adding ldap3
      connection pooling or an external LDAP proxy (e.g., HAProxy).

    - No pagination for group searches: POSIX mode group searches may be
      truncated if the directory contains >1000 matching groups per search base.
      Most deployments won't hit this limit.

    - No nested group resolution: Active Directory nested groups (group-in-group)
      require recursive memberOf queries or LDAP_MATCHING_RULE_IN_CHAIN (OID
      1.2.840.113556.1.4.1941). Currently only direct group memberships are
      resolved. Configure flattened groups or use AD's tokenGroups attribute
      if nested resolution is required.

See Also:
    _create_servers(): Server-level TLS configuration (use_ssl, tls)
    _establish_connection(): Connection-level TLS upgrade (AUTO_BIND modes)
    _verify_user_password(): Manual TLS upgrade sequencing
"""

from __future__ import annotations

import logging
import random
import ssl
from secrets import token_hex
from typing import Any, Final, Literal, NamedTuple, cast, overload

import anyio
from anyio import CapacityLimiter
from ldap3 import (
    AUTO_BIND_DEFAULT,
    AUTO_BIND_NO_TLS,
    AUTO_BIND_NONE,
    AUTO_BIND_TLS_BEFORE_BIND,
    NONE,
    SUBTREE,
    Connection,
    Entry,
    Server,
    Tls,
)
from ldap3.core.exceptions import LDAPException, LDAPInvalidCredentialsResult, LDAPInvalidDnError
from ldap3.core.results import RESULT_SIZE_LIMIT_EXCEEDED
from ldap3.utils.conv import escape_filter_chars
from ldap3.utils.dn import parse_dn

from phoenix.config import AssignableUserRoleName, LDAPConfig

logger = logging.getLogger(__name__)

# Limit concurrent LDAP operations to prevent thread pool exhaustion.
# Each LDAP authentication spawns a thread (ldap3 is synchronous-only). This
# limit acts as a safety valve against credential stuffing attacks or runaway
# retry loops, not as a throughput target. 10 concurrent operations is more
# than sufficient for typical Phoenix deployments.
_LDAP_CONCURRENCY_LIMIT: Final[int] = 10
_ldap_limiter: CapacityLimiter | None = None


def _get_ldap_limiter() -> CapacityLimiter:
    """Get or create the LDAP concurrency limiter (lazy initialization).

    Lazy initialization is required because CapacityLimiter must be created
    within an async context (it uses the current event loop). Creating it at
    module load time would fail since there's no event loop yet.
    """
    global _ldap_limiter
    if _ldap_limiter is None:
        _ldap_limiter = CapacityLimiter(_LDAP_CONCURRENCY_LIMIT)
    return _ldap_limiter


def canonicalize_dn(dn: str) -> str | None:
    r"""Canonicalize a Distinguished Name per RFC 4514.

    This function normalizes DNs to a canonical form for case-insensitive
    comparison and storage. It handles:
    - Case normalization (attribute types and values lowercased)
    - Whitespace normalization (stripped around = and ,)
    - Multi-valued RDN ordering (sorted alphabetically for deterministic output)
    - Escaped character preservation (maintains \, \+ etc.)
    - Hex encoding normalization (decoded to canonical form)

    RFC 4514 states that DNs are case-insensitive for comparison, but leaves
    the canonical form implementation-defined. This implementation ensures that
    semantically equivalent DNs (e.g., "cn=John" vs "CN=john") map to the same
    canonical string, preventing duplicate database entries.

    Args:
        dn: LDAP Distinguished Name to canonicalize

    Returns:
        str: Canonical lowercase DN with normalized whitespace and sorted RDN components.
        None: If DN parsing fails. Callers should handle this explicitly to avoid
              inconsistent matching behavior.

    Examples:
        >>> canonicalize_dn("cn=John,ou=Users,dc=Example,dc=com")
        'cn=john,ou=users,dc=example,dc=com'

        >>> canonicalize_dn("CN=john+EMAIL=john@corp.com,OU=users,DC=example,DC=com")
        'cn=john+email=john@corp.com,ou=users,dc=example,dc=com'

        >>> canonicalize_dn("email=john@corp.com+cn=John,ou=Users,dc=Example,dc=com")
        'cn=john+email=john@corp.com,ou=users,dc=example,dc=com'  # Sorted

        >>> canonicalize_dn("invalid dn syntax")
        None

    References:
        RFC 4514 Section 4: String representation of DNs are case-insensitive
        ldap3 parse_dn(): Validates syntax and decomposes into components
    """
    # Handle empty DN (root DSE) - this is a valid DN per RFC 4514
    if not dn.strip():
        return ""

    try:
        # Parse DN with escaping and whitespace stripping
        components = parse_dn(dn, escape=True, strip=True)
    except LDAPInvalidDnError:
        # Return None instead of falling back to simple lowercase.
        # This prevents inconsistent canonicalization where the same DN
        # could have different canonical forms depending on parser behavior.
        # Callers must handle None explicitly (typically by skipping the DN).
        return None

    # Build canonical DN
    canonical_parts = []
    current_rdn_components = []

    for attr_type, attr_value, separator in components:
        # Normalize attribute type and value to lowercase
        normalized_component = (attr_type.lower(), attr_value.lower())
        current_rdn_components.append(normalized_component)

        # When we hit a comma (or end), we've completed an RDN
        if separator == "," or separator == "":
            # Sort multi-valued RDN components for deterministic output
            # Example: "email=x+cn=y" and "cn=y+email=x" both become "cn=y+email=x"
            # Sorts by (type, value) tuple to handle rare cases of duplicate attribute types
            current_rdn_components.sort()

            # Format the RDN
            rdn_str = "+".join(f"{attr}={value}" for attr, value in current_rdn_components)
            canonical_parts.append(rdn_str)

            # Reset for next RDN
            current_rdn_components = []

    return ",".join(canonical_parts)


class LDAPUserInfo(NamedTuple):
    """Authenticated LDAP user information.

    Attributes:
        email: User's email address, or None if PHOENIX_LDAP_ATTR_EMAIL is "null".
               When None, a null email marker will be generated from unique_id.
        display_name: User's display name for UI
        groups: Tuple of group DNs the user belongs to (immutable)
        user_dn: User's Distinguished Name (for audit/logging, NOT used for identity matching)
        ldap_username: Username used to authenticate
        role: Phoenix role mapped from LDAP groups
        unique_id: Immutable identifier (objectGUID/entryUUID). Required when email is None.
    """

    email: str | None
    display_name: str
    groups: tuple[str, ...]
    user_dn: str
    ldap_username: str
    role: str
    unique_id: str | None = None  # objectGUID (AD), entryUUID (OpenLDAP) if configured


class LDAPAuthenticator:
    """Handles LDAP authentication and user attribute retrieval.

    Supports both Active Directory and OpenLDAP:
    - Active Directory: Uses memberOf attribute for group membership
    - OpenLDAP/POSIX: Uses group search with member attribute
    - Multi-server failover for high availability
    - TLS/LDAPS with certificate validation (RFC 4513)
    - Group-based role mapping with wildcard support
    """

    # Maximum credential lengths to prevent DoS via oversized inputs.
    # These are generous limits - real usernames/passwords are much shorter.
    _MAX_USERNAME_LENGTH: Final[int] = 256
    _MAX_PASSWORD_LENGTH: Final[int] = 1024

    def __init__(self, config: LDAPConfig):
        """Initialize LDAP authenticator with configuration.

        Args:
            config: LDAP configuration including servers, search bases, and mappings
        """
        self.config = config
        self.servers = self._create_servers()

    def _create_servers(self) -> list[Server]:
        """Create ldap3 Server objects for all configured hosts.

        TLS Configuration Modes:
            Phoenix supports three LDAP connection modes via tls_mode:

            1. LDAPS (tls_mode="ldaps", port 636):
                - Server: use_ssl=True, tls=<Tls config>
                - TLS established at TCP connection layer (like HTTPS)
                - Bind credentials encrypted from the start
                - No start_tls() call needed

            2. STARTTLS (tls_mode="starttls", port 389):
                - Server: use_ssl=False, tls=<Tls config>
                - Connection starts plaintext, upgraded to TLS via start_tls()
                - Bind credentials encrypted ONLY after start_tls() completes
                - CRITICAL: Must call start_tls() before bind (see _establish_connection)

            3. Plaintext (tls_mode="none", testing only):
                - Server: use_ssl=False, tls=None
                - All data transmitted unencrypted
                - NOT recommended for production

        Key ldap3 Parameters:
            use_ssl: Enable TLS at connection layer (True for LDAPS only)
            tls: TLS configuration object (cert validation, certificates, etc.)
                - Set for both LDAPS and STARTTLS (start_tls() uses this config)
                - None for plaintext mode
                - Supports advanced options:
                    * Custom CA certificates (ca_certs_file)
                    * Client certificates for mutual TLS
                      (local_certificate_file, local_private_key_file)

        Returns:
            list[Server]: Server objects for all configured hosts (supports failover).
        """
        tls_config = None
        use_tls = self.config.tls_mode != "none"
        if use_tls:
            # Configure TLS with certificate validation and optional advanced settings
            tls_kwargs: dict[str, Any] = {
                "validate": ssl.CERT_REQUIRED if self.config.tls_verify else ssl.CERT_NONE
            }

            # Custom CA certificate for private/internal CAs
            if self.config.tls_ca_cert_file:
                tls_kwargs["ca_certs_file"] = self.config.tls_ca_cert_file

            # Client certificate for mutual TLS
            if self.config.tls_client_cert_file and self.config.tls_client_key_file:
                tls_kwargs["local_certificate_file"] = self.config.tls_client_cert_file
                tls_kwargs["local_private_key_file"] = self.config.tls_client_key_file

            tls_config = Tls(**tls_kwargs)

        servers = []
        for host in self.config.hosts:
            server = Server(
                host,
                port=self.config.port,
                use_ssl=(self.config.tls_mode == "ldaps"),
                tls=tls_config,
                connect_timeout=10,
                get_info=NONE,  # Don't fetch schema/DSA info we don't use
            )
            servers.append(server)

        return servers

    def _establish_connection(self, server: Server) -> Connection:
        """Establish a connection to the LDAP server.

        Connection Flow by TLS Mode:
            STARTTLS Mode (tls_mode="starttls"):
                1. Open plaintext TCP connection (port 389)
                2. Send Extended Request to upgrade to TLS
                3. Perform TLS handshake
                4. Send bind credentials (now encrypted)

                Implementation: Use AUTO_BIND_TLS_BEFORE_BIND to ensure step 2-3
                happen before step 4.

            LDAPS Mode (tls_mode="ldaps"):
                1. Establish TLS connection (port 636)
                2. Send bind credentials (already encrypted)

                Implementation: Use AUTO_BIND_NO_TLS (TLS already active from Server)

            Plaintext Mode (tls_mode="none"):
                1. Open plaintext TCP connection (port 389)
                2. Send bind credentials (unencrypted)

                Implementation: Use AUTO_BIND_NO_TLS (no TLS to upgrade)

        ldap3 auto_bind Modes:
            AUTO_BIND_TLS_BEFORE_BIND: Call start_tls(), then bind
                - Required for STARTTLS to encrypt credentials
            AUTO_BIND_NO_TLS: Bind immediately without calling start_tls()
                - Correct for LDAPS (TLS already active via use_ssl=True)
                - Correct for plaintext (no TLS desired)

        Security Note:
            For STARTTLS, using auto_bind=True (or AUTO_BIND_NO_TLS) would
            transmit bind credentials in PLAINTEXT before upgrading to TLS.
            This is a critical security vulnerability.

        Bind Types:
            Service account: Uses config.bind_dn and config.bind_password
            Anonymous: No credentials (for servers allowing anonymous reads)

        Args:
            server: Server object (from _create_servers) with TLS pre-configured.

        Returns:
            Connection: Bound connection (service account or anonymous).
        """
        # Determine auto_bind mode based on TLS configuration
        # CRITICAL: Must use AUTO_BIND_TLS_BEFORE_BIND for STARTTLS to encrypt passwords
        auto_bind_mode: Literal["DEFAULT", "NONE", "NO_TLS", "TLS_BEFORE_BIND", "TLS_AFTER_BIND"]
        if self.config.tls_mode == "starttls":
            auto_bind_mode = AUTO_BIND_TLS_BEFORE_BIND
        else:
            # LDAPS: TLS already active via use_ssl=True on Server, bind normally
            # Plaintext (none): No TLS, bind normally
            auto_bind_mode = AUTO_BIND_NO_TLS

        if self.config.bind_dn and self.config.bind_password:
            # Service account bind using ldap3's auto_bind feature.
            #
            # Socket Cleanup Note (ldap3 library behavior):
            #   ldap3's auto_bind has inconsistent socket cleanup on failure:
            #   - LDAPS mode: _cleanup_socket() called on TLS wrap failure (base.py:292)
            #   - STARTTLS mode: NO cleanup if wrap_socket raises in _start_tls (tls.py:287-291)
            #   - bind() failure: NO cleanup, exception propagates up
            #   - start_tls() returns False: unbind() IS called (connection.py:424)
            #
            #   If the constructor raises (during _do_auto_bind), the socket may leak until
            #   Python's GC collects the Connection object. This is acceptable because:
            #   1. GC will eventually close the socket (Connection has no __del__, but socket does)
            #   2. This only affects service account bind during TLS/bind failures (rare)
            #   3. Phoenix has timeouts (10s connect, 30s operations) preventing hangs
            #   4. Rate limiting prevents attackers from rapidly triggering many leaks
            #
            #   The anonymous bind path below has explicit cleanup because we control the
            #   sequencing. For service account binds, we rely on ldap3's auto_bind which
            #   handles the common success case correctly.
            #
            #   See: https://github.com/cannatag/ldap3 for upstream library
            return Connection(
                server,
                user=self.config.bind_dn,
                password=self.config.bind_password,
                auto_bind=auto_bind_mode,
                raise_exceptions=True,
                receive_timeout=30,  # Timeout for LDAP operations (bind, search)
                # SECURITY: Disable referral following to prevent credential leakage.
                # ldap3 defaults to following referrals to ANY server and sending credentials.
                # An attacker-controlled referral could steal service account credentials.
                # Phoenix already has multi-server failover, so referrals are unnecessary.
                auto_referrals=False,
            )

        # Anonymous bind case - must manually sequence open/start_tls before bind
        #
        # AUTO_BIND_DEFAULT defers bind() until the context manager is entered.
        # This is NOT the same as AUTO_BIND_NONE (which skips bind entirely).
        #
        # Why not AUTO_BIND_TLS_BEFORE_BIND?
        #   That performs open→start_tls→bind atomically in the constructor.
        #   For anonymous binds (no user/password), we need manual sequencing
        #   to ensure start_tls() completes before bind(). The sequence is:
        #
        #   1. Connection() - creates connection object (no network I/O)
        #   2. open() - establishes TCP connection
        #   3. start_tls() - upgrades to TLS (for STARTTLS mode)
        #   4. return conn - caller uses `with conn:` which triggers bind()
        #
        #   This ensures TLS is active before any bind credentials are sent.
        conn = Connection(
            server,
            auto_bind=AUTO_BIND_DEFAULT,
            raise_exceptions=True,
            receive_timeout=30,
            # SECURITY: Disable referral following (see service account connection above)
            auto_referrals=False,
        )
        try:
            conn.open()
            # Upgrade to TLS for STARTTLS mode before any bind operations
            if self.config.tls_mode == "starttls":
                conn.start_tls()
            return conn
        except Exception:
            # CRITICAL: Unbind on any exception to prevent socket leak
            # Threat: open() or start_tls() may open a socket but raise before bind.
            # Without cleanup, repeated TLS handshake failures would leak file descriptors
            # and eventually exhaust the process (DoS). unbind() safely closes socket
            # even if connection was never bound.
            conn.unbind()  # type: ignore[no-untyped-call]
            raise

    async def authenticate(self, username: str, password: str) -> LDAPUserInfo | None:
        """Authenticate user against LDAP and return user info.

        This method performs the following steps:
        1. Connect to LDAP server (with failover if multiple servers configured)
        2. Bind with service account (if configured) or directly with user credentials
        3. Search for user by username
        4. Authenticate user (bind with user's credentials)
        5. Retrieve user attributes (email, display name)
        6. Query user's group memberships
        7. Map groups to Phoenix role

        Performance & Security - Thread Pool Isolation:
            All LDAP operations (connection, TLS handshake, bind, search) are executed
            in a thread pool to prevent blocking the FastAPI event loop.

            Why this matters (DoS prevention):
            - ldap3 library is synchronous-only (blocks calling thread)
            - Without isolation, each /auth/ldap/login blocks the event loop
            - Attacker opens slow TLS handshakes → starves all FastAPI workers
            - Even rate-limited requests would queue indefinitely

            Mitigation: anyio.to_thread.run_sync() runs LDAP ops in background threads,
            keeping the main event loop responsive for other requests.

        Timeout Architecture (Defense-in-Depth):
            Multiple timeout layers ensure no single failure can hang the system:

            ┌─────────────────────────────────────────────────────────────┐
            │ HTTP Request: 60s (anyio.fail_after)                        │
            │   Returns 500 to client if exceeded; thread continues       │
            │  ┌─────────────────────────────────────────────────────────┐│
            │  │ Thread Pool Task (no direct timeout)                    ││
            │  │   Runs until LDAP operation completes or socket times out│
            │  │  ┌─────────────────────────────────────────────────────┐││
            │  │  │ LDAP Operation: 30s (receive_timeout)               │││
            │  │  │   Bind, search, and other LDAP protocol operations  │││
            │  │  │  ┌─────────────────────────────────────────────────┐│││
            │  │  │  │ TCP Connect: 10s (connect_timeout)              ││││
            │  │  │  │   Initial socket connection to LDAP server      ││││
            │  │  │  └─────────────────────────────────────────────────┘│││
            │  │  └─────────────────────────────────────────────────────┘││
            │  └─────────────────────────────────────────────────────────┘│
            └─────────────────────────────────────────────────────────────┘

            Rationale for each layer:
            - TCP Connect (10s): Network unreachable or firewall should fail fast
            - LDAP Operation (30s): Bind/search should complete quickly; slow response
              indicates server overload. This is the actual timeout that stops the thread.
            - HTTP Request (60s): Prevents client from hanging indefinitely. Note that
              Python threads running native C code cannot be cancelled, so this only
              returns an error to the client—the thread continues until socket timeout.

            Multi-Server Failover & Load Distribution:
            When multiple LDAP servers are configured, they are shuffled randomly on each
            authentication attempt. This provides load distribution across replicas and
            prevents a slow primary from always causing delays. Failover to the next
            server occurs on LDAPException (connection failure, timeout, etc.).

            Each server attempt can take up to 30s (receive_timeout) if the server
            accepts TCP but doesn't respond to LDAP ops.

            With N unresponsive servers: N × 30s total time before all servers exhausted.
            - 1 server: 30s max (well within 60s HTTP timeout)
            - 2 servers: 60s max (equals HTTP timeout—may return before 2nd completes)
            - 3+ servers: exceeds 60s (HTTP timeout fires, not all servers tried)

            This is an intentional trade-off: the 60s HTTP timeout prioritizes client
            experience over exhaustively trying all servers. In practice, if multiple
            servers are all unresponsive, the infrastructure has larger problems. The
            60s limit also aligns with common load balancer timeouts (nginx, AWS ALB).

        Security:
            - Empty username/password rejected (prevents anonymous bind bypass)
            - LDAP injection prevention via RFC 4515 escaping (blocks filter manipulation)
            - Exception sanitization (no internal server details leaked to attackers)
            - Thread pool isolation prevents event loop DoS (slow LDAP can't block other requests)
            - Timeouts prevent resource exhaustion (hanging threads would accumulate)
            - Socket cleanup prevents file descriptor leaks (failed binds close connections)
            - Timing attack mitigation via dummy bind (prevents username enumeration)

        Args:
            username: LDAP username (e.g., "jdoe" for Active Directory sAMAccountName)
            password: User's password

        Returns:
            LDAPUserInfo object or None if authentication fails (including timeout)
        """
        # Run synchronous ldap3 operations in thread pool to avoid blocking event loop.
        #
        # Concurrency limiting: _get_ldap_limiter() caps concurrent LDAP operations to
        # prevent thread pool exhaustion during traffic spikes. Requests exceeding the
        # limit will wait (not fail) until a slot is available.
        #
        # Timeout handling: fail_after() prevents HTTP request hang but cannot stop the
        # thread itself (threads running native code cannot be cancelled). The real
        # timeout is receive_timeout=30 on Connection objects, which terminates blocking
        # socket operations inside the thread. We catch TimeoutError to return a clean
        # authentication failure rather than propagating a 500 error.
        try:
            with anyio.fail_after(60):
                return await anyio.to_thread.run_sync(
                    self._authenticate,
                    username,
                    password,
                    limiter=_get_ldap_limiter(),
                )
        except TimeoutError:
            # LDAP operation exceeded 60s timeout. This typically means:
            # 1. LDAP server is overloaded or unresponsive
            # 2. Network issues causing slow responses
            # 3. Very slow TLS handshake (e.g., OCSP/CRL checks)
            #
            # The background thread continues running until socket timeout (30s),
            # but we return immediately to the client. Log as error for monitoring.
            logger.error(
                "LDAP authentication timed out after 60 seconds. "
                "Check LDAP server health and network connectivity."
            )
            return None

    def _authenticate(self, username: str, password: str) -> LDAPUserInfo | None:
        """Synchronous LDAP authentication (called from thread pool via authenticate())."""
        # SECURITY: Reject empty credentials to prevent anonymous bind bypass
        # Threat: LDAP RFC 4513 §5.1.2 defines Simple Authentication with empty password
        # as "unauthenticated". Many LDAP servers grant anonymous read access for empty
        # password (bind succeeds with DN but no actual authentication). An attacker could
        # send empty password to bypass authentication if we don't explicitly check.
        if not username or not username.strip():
            logger.warning("LDAP authentication rejected: empty username")
            return None
        if not password:
            logger.warning("LDAP authentication rejected: empty password")
            return None

        # SECURITY: Reject oversized credentials to prevent DoS
        # Threat: Attacker sends megabyte-sized username/password to waste memory,
        # CPU (escaping, filter building), and LDAP server resources.
        if len(username) > self._MAX_USERNAME_LENGTH:
            logger.warning("LDAP authentication rejected: username too long")
            return None
        if len(password) > self._MAX_PASSWORD_LENGTH:
            logger.warning("LDAP authentication rejected: password too long")
            return None

        # SECURITY: Prevent LDAP filter injection (RFC 4515)
        # Attack: username="*" or "admin*" or "admin)(uid=*" could bypass authentication
        # or enumerate users. escape_filter_chars() escapes special LDAP filter characters:
        # * → \2a, ( → \28, ) → \29, \ → \5c, NUL → \00
        escaped_username = escape_filter_chars(username)

        # Shuffle servers for load distribution across replicas.
        # Since LDAP servers are assumed to be replicas with identical data,
        # randomizing the order prevents the first server from receiving all
        # initial requests and provides more even load distribution.
        servers = random.sample(self.servers, len(self.servers))
        for server in servers:
            try:
                # Step 1: Create connection with service account (or anonymous)
                with self._establish_connection(server) as conn:
                    # Step 2 & 3: Search for user
                    user_entry = self._search_user(conn, escaped_username)
                    if not user_entry:
                        # TIMING ATTACK MITIGATION: Perform dummy bind to prevent username
                        # enumeration
                        #
                        # Without this, an attacker could distinguish "user not found" from
                        # "wrong password" by measuring response times:
                        #   - User not found: Fast response (only search performed)
                        #   - Wrong password: Slow response (search + bind attempt)
                        #
                        # By always performing a bind operation (even with dummy credentials
                        # when user doesn't exist), both code paths take similar time,
                        # preventing attackers from enumerating valid usernames.
                        #
                        # The dummy DN is intentionally invalid and will always fail bind,
                        # but the network round-trip and TLS operations equalize timing.
                        self._dummy_bind_for_timing(server, password)
                        logger.info("User not found in LDAP directory")

                        # DESIGN DECISION: Return immediately instead of trying other servers
                        #
                        # Why not failover to other servers when user is not found?
                        #
                        # 1. SEMANTIC CORRECTNESS (primary reason):
                        #    In a properly configured LDAP environment, "user not found" is a
                        #    definitive answer. Failover servers are replicas of the same directory
                        #    and should have identical user sets. If user doesn't exist on server A,
                        #    they won't exist on server B either. Multi-server failover is designed
                        #    for server unavailability (LDAPException → continue), not for data
                        #    inconsistency between replicas.
                        #
                        # 2. EDGE CASES (replica lag, AD GC/DC differences):
                        #    Temporary inconsistencies can occur during replication, but these are
                        #    rare and transient. Designing around them would add complexity for
                        #    little practical benefit, and could mask underlying infrastructure
                        #    issues that should be addressed at the LDAP layer.
                        return None

                    user_dn = user_entry.entry_dn

                    # Step 4: Authenticate user by binding with their credentials
                    # We use a separate connection to verify the password to avoid
                    # dropping the main connection which might be needed for group search.
                    if not self._verify_user_password(server, user_dn, password):
                        logger.info("LDAP password verification failed")
                        return None

                    # Step 5: Extract user attributes
                    # Email handling depends on whether attr_email is configured:
                    # - If configured: read from LDAP, fail if missing
                    # - If empty: email will be None, marker generated later
                    email: str | None = None
                    if self.config.attr_email:
                        email = _get_attribute(user_entry, self.config.attr_email)
                        if not email:
                            # Fail loudly: admin configured an attribute that doesn't exist
                            logger.error(
                                f"LDAP user missing required email attribute "
                                f"({self.config.attr_email}). Either populate this attribute "
                                f"or set PHOENIX_LDAP_ATTR_EMAIL=null"
                            )
                            return None
                    # else: email stays None, will be handled by get_or_create_ldap_user

                    display_name = (
                        _get_attribute(user_entry, self.config.attr_display_name)
                        if self.config.attr_display_name
                        else None
                    )

                    # Extract unique_id if configured (objectGUID, entryUUID, etc.)
                    unique_id: str | None = None
                    if self.config.attr_unique_id:
                        unique_id = _get_unique_id(user_entry, self.config.attr_unique_id)
                        if not unique_id:
                            # Fail loudly: user explicitly configured unique_id, so missing
                            # attribute indicates misconfiguration (likely typo). Don't silently
                            # fall back to email - that would mask the error.
                            logger.error(
                                f"LDAP user missing configured unique_id attribute "
                                f"({self.config.attr_unique_id}). "
                                f"Check PHOENIX_LDAP_ATTR_UNIQUE_ID "
                                f"spelling. Common values: objectGUID (AD), entryUUID (OpenLDAP)."
                            )
                            return None

                    # Step 6: Get user's group memberships
                    # Reuses the existing service/anonymous connection
                    groups = self._get_user_groups(conn, user_entry, username)

                    # Step 7: Map groups to Phoenix role
                    role = self.map_groups_to_role(groups)
                    if not role:
                        logger.info(
                            "LDAP authentication denied: user not member of any configured group. "
                            "Configure PHOENIX_LDAP_GROUP_ROLE_MAPPINGS to include user's groups."
                        )
                        return None

                    return LDAPUserInfo(
                        email=email,
                        display_name=display_name or username,
                        groups=tuple(groups),
                        user_dn=user_dn,
                        ldap_username=username,
                        role=role,
                        unique_id=unique_id,
                    )

            except LDAPException as e:
                # SECURITY: Don't leak internal LDAP server error details
                # Threat: Exception messages may contain sensitive info (server IPs, DNs,
                # configuration details, internal paths). Only log error type (e.g.,
                # "LDAPSocketOpenError") to avoid information disclosure to attackers
                # monitoring logs or error responses.
                logger.warning(
                    f"LDAP server {server.host} failed during authentication. "
                    f"Error type: {type(e).__name__}"
                )
                continue  # Try next server

        # All servers failed
        logger.error("All LDAP servers failed")
        return None

    def _search_user(self, conn: Connection, escaped_username: str) -> Entry | None:
        """Search for user in LDAP directory across all configured search bases.

        Searches each base DN in order until a user is found. This allows organizations
        with users in multiple OUs (e.g., employees and contractors) to authenticate
        against a single LDAP configuration.

        Args:
            conn: Active LDAP connection
            escaped_username: Escaped username for filter

        Returns:
            User entry or None if not found or ambiguous
        """
        user_filter = self.config.user_search_filter.replace("%s", escaped_username)

        # Build attribute list - filter out None values (e.g., attr_email in no-email mode)
        attributes = [
            attr
            for attr in [
                self.config.attr_email,
                self.config.attr_display_name,
                self.config.attr_member_of,
                self.config.attr_unique_id,
                self.config.group_search_filter_user_attr,
            ]
            if attr  # Filter out None and empty strings
        ]

        # Search each base DN in order
        for search_base in self.config.user_search_base_dns:
            conn.search(
                search_base=search_base,
                search_filter=user_filter,
                search_scope=SUBTREE,
                attributes=attributes,
            )

            if len(conn.entries) == 0:
                # Not found in this base, try next
                continue
            elif len(conn.entries) > 1:
                # SECURITY: Reject ambiguous results to prevent non-deterministic authentication
                # Attack scenario: Username "jsmith" exists in both ou=contractors,dc=corp and
                # ou=employees,dc=corp. Blindly taking first result means authentication outcome
                # depends on LDAP server's arbitrary ordering (could change between queries).
                # This allows an attacker to exploit timing or replica inconsistencies.
                logger.error(
                    f"Ambiguous LDAP search: found {len(conn.entries)} matching entries "
                    f"in search base '{search_base}'. Rejecting authentication for safety. "
                    f"Fix: Use more specific user_search_filter to ensure unique results."
                )
                return None
            else:
                # Exactly one match - success
                return cast(Entry, conn.entries[0])

        # Not found in any search base
        logger.info("LDAP user search returned no results in any configured search base")
        return None

    def _dummy_bind_for_timing(self, server: Server, password: str) -> None:
        """Perform a dummy bind to equalize response timing when user is not found.

        Timing Attack Prevention:
            This method exists solely to prevent username enumeration via timing attacks.

            Attack scenario without mitigation:
                1. Attacker sends login request with "admin" / "wrongpass"
                2. If "admin" exists: search succeeds → bind attempted → ~150ms response
                3. If "admin" doesn't exist: search fails → immediate return → ~50ms response
                4. Attacker measures response times to enumerate valid usernames

            Mitigation:
                When a user is not found, we still perform a bind operation against
                a known-invalid DN. This ensures both "user not found" and "wrong password"
                code paths perform similar network operations (TLS handshake, bind attempt),
                making response times indistinguishable.

            Why this works:
                The timing-sensitive operations are network I/O (TLS, LDAP protocol).
                By performing the same I/O operations regardless of whether the user exists,
                we eliminate the timing side-channel. The dummy bind will always fail
                (invalid DN), but the network round-trip equalizes timing.

        Args:
            server: LDAP server to connect to (same as real bind).
            password: User-provided password (used for realistic timing).
        """
        # Use a randomized invalid DN to prevent caching/optimization by LDAP server
        # The actual credentials don't matter - we just need the network round-trip
        dummy_dn = f"cn=dummy-{token_hex(8)},dc=invalid,dc=local"
        try:
            self._verify_user_password(server, dummy_dn, password)
        except Exception:
            # Expected to fail - we only care about the timing, not the result
            pass

    def _verify_user_password(self, server: Server, user_dn: str, password: str) -> bool:
        """Verify user's password by attempting to bind as that user.

        TLS Sequencing for STARTTLS:
            Unlike _establish_connection (which uses AUTO_BIND_TLS_BEFORE_BIND),
            this method uses manual sequencing:

            1. Create connection with auto_bind=False
            2. Open connection (plaintext for STARTTLS)
            3. Call start_tls() explicitly (upgrade to TLS)
            4. Call bind() with user credentials (now encrypted)

        Why Manual Sequencing?
            We need explicit error handling between open() and bind() to ensure
            socket cleanup in the finally block. AUTO_BIND_TLS_BEFORE_BIND would
            combine steps 2-4 into a single auto_bind call, hiding exceptions and
            making it harder to guarantee socket cleanup on partial failures.
            Manual sequencing gives us fine-grained control over error paths.

        TLS Modes:
            STARTTLS: start_tls() called before bind() to encrypt credentials
            LDAPS: TLS already active from Server (use_ssl=True), bind directly
            Plaintext: No TLS, bind directly (testing only)

        Security Note:
            Skipping start_tls() for STARTTLS mode would transmit the password
            in plaintext despite TLS being "enabled" in configuration.

        Exception Handling:
            LDAPInvalidCredentialsResult is caught and returns False (wrong password).
            Other LDAPExceptions (server errors, timeouts) are re-raised to trigger
            failover to the next server in _authenticate().

        Args:
            server: Server object with TLS pre-configured.
            user_dn: User's Distinguished Name (e.g., "uid=alice,ou=users,dc=example,dc=com").
            password: User's password to verify.

        Returns:
            bool: True if bind succeeds (password valid), False otherwise.

        Raises:
            LDAPException: For connection/server errors (NOT invalid credentials).
        """
        user_conn = Connection(
            server,
            user=user_dn,
            password=password,
            auto_bind=AUTO_BIND_NONE,  # No auto-bind; we call open/start_tls/bind manually
            raise_exceptions=True,
            receive_timeout=30,  # Timeout for bind operation
            # SECURITY: Disable referral following to prevent credential leakage
            auto_referrals=False,
        )
        try:
            user_conn.open()
            # CRITICAL: Upgrade to TLS BEFORE sending password for STARTTLS mode
            if self.config.tls_mode == "starttls":
                user_conn.start_tls()
            user_conn.bind()
            return user_conn.bound
        except LDAPInvalidCredentialsResult:
            # Wrong password - return False instead of raising.
            # This prevents invalid credentials from triggering server failover
            # in _authenticate() (failover is for server errors, not auth failures).
            return False
        finally:
            # CRITICAL: Always unbind to prevent socket leak
            # Threat: If open() or start_tls() or bind() raises, connection has an open
            # socket but bound=False. Conditional cleanup (if user_conn.bound: unbind())
            # would skip cleanup, leaking the file descriptor. Repeated failed logins
            # would exhaust process FD limit (typically 1024) causing service crash.
            # unbind() safely closes socket regardless of bind state.
            user_conn.unbind()  # type: ignore[no-untyped-call]

    def _get_user_groups(self, conn: Connection, user_entry: Entry, username: str) -> list[str]:
        """Get user's group memberships.

        Two modes are supported, determined by group_search_filter presence:

        AD Mode (group_search_filter NOT set):
            Reads the memberOf attribute directly from the user entry.
            This is the recommended approach for Active Directory, which
            automatically populates memberOf with the user's group DNs.

        Search Mode (group_search_filter IS set):
            Searches for groups that contain the user. Used for POSIX groups
            (posixGroup) or when memberOf is not available.

            The %s placeholder in the filter is replaced with:
            - If group_search_filter_user_attr is set: That attribute's value
              from the user entry (e.g., uid="jdoe" or distinguishedName="...")
            - If not set: The login username directly

            Common patterns:
            - POSIX (memberUid=%s): memberUid contains usernames like "jdoe"
              → Use username directly (default) or group_search_filter_user_attr=uid
            - groupOfNames (member=%s): member contains full DNs
              → Requires group_search_filter_user_attr=distinguishedName (AD only)

        Size Limit Warning:
            If the LDAP server's size limit is exceeded (commonly 1000 entries),
            a warning is logged and partial results are returned. This can cause
            users to receive incorrect role mappings if their groups are not in
            the returned subset. Configure more specific group_search_base_dns
            or increase the server's sizelimit if this occurs.

        Args:
            conn: Active LDAP connection (with service account if configured)
            user_entry: User entry from search
            username: User's login username (used as default filter value)

        Returns:
            List of group DNs (Distinguished Names)
        """
        # Mode determined by group_search_filter presence
        if not self.config.group_search_filter:
            if not self.config.attr_member_of:
                return []
            # AD mode: Read memberOf attribute from user entry
            member_of = _get_attribute(user_entry, self.config.attr_member_of, multiple=True)
            return member_of if member_of else []

        # POSIX mode: Search for groups containing this user
        groups: list[str] = []
        group_search_filter = self.config.group_search_filter
        if self.config.group_search_base_dns:
            # Determine what value to substitute for %s in the filter
            # - If group_search_filter_user_attr is set: Use that attribute's value
            #   (e.g., "uid" -> "admin")
            # - If not set: Use the username
            #
            # POSIX memberUid contains usernames ("admin"), not full DNs.
            if self.config.group_search_filter_user_attr:
                # Get the specified attribute value from the user entry
                filter_value = _get_attribute(user_entry, self.config.group_search_filter_user_attr)
                if not filter_value:
                    # Attribute not found on user - can't search for groups
                    attr = self.config.group_search_filter_user_attr
                    logger.warning(
                        f"User entry missing attribute '{attr}' required for group search filter"
                    )
                    return []
            else:
                # use the username
                filter_value = username

            # SECURITY: Escape value for LDAP filter (RFC 4515)
            # Threat: Values can contain special chars like parentheses, asterisks, backslashes
            # (e.g., "user(contractor)*"). If inserted into filter unescaped,
            # these could break filter syntax or allow injection. Always escape before
            # string substitution, even though value comes from trusted LDAP server.
            escaped_value = escape_filter_chars(filter_value)
            group_filter = group_search_filter.replace("%s", escaped_value)

            # Search each group base DN and collect groups from all
            for group_search_base in self.config.group_search_base_dns:
                try:
                    conn.search(
                        search_base=group_search_base,
                        search_filter=group_filter,
                        search_scope=SUBTREE,
                        attributes=["cn"],
                    )

                    # Check if results were truncated by server's size limit
                    # ldap3 doesn't raise for sizeLimitExceeded, it returns partial results
                    if conn.result and conn.result.get("result") == RESULT_SIZE_LIMIT_EXCEEDED:
                        logger.warning(
                            f"LDAP group search hit server size limit for base "
                            f"'{group_search_base}'. Results may be incomplete. "
                            f"Consider using more specific group_search_base_dns or "
                            f"increasing the server's sizelimit."
                        )

                    for group_entry in conn.entries:
                        groups.append(group_entry.entry_dn)
                except LDAPException as e:
                    # SECURITY: Don't leak internal LDAP server error details
                    logger.warning(
                        f"LDAP group search failed for base '{group_search_base}'. "
                        f"Error type: {type(e).__name__}"
                    )

        return groups

    def map_groups_to_role(self, group_dns: list[str]) -> AssignableUserRoleName | None:
        """Map LDAP group DNs to Phoenix role.

        Mapping Behavior:
            - Iterates through mappings in configuration order (first match wins)
            - Supports wildcard "*" to match all users
            - Case-insensitive DN matching per RFC 4514
            - DN normalization via canonicalize_dn to handle spacing/order/escape differences

        Design Decision - First Match Wins vs. Highest Role Wins:
            This implementation uses "first match wins" (configuration order determines
            priority) rather than "highest role wins" (role hierarchy determines priority).
            This matches Grafana's LDAP behavior and is the common pattern in authorization
            systems (firewall rules, nginx routing, ACLs).

            Rationale:
            1. Explicit administrator control: Config order gives admins full control over
               precedence. Role-level priority locks you into a fixed hierarchy (ADMIN >
               MEMBER > VIEWER), but organizations may have complex access rules that don't
               map cleanly to role hierarchy.

            2. Simplicity and predictability: Easy to reason about ("whatever comes first
               in config wins") and easy to debug (just look at config order). No hidden
               logic comparing role levels.

            3. Industry convention: Matches behavior in firewalls (iptables), web servers
               (nginx location blocks), and access control lists. Administrators familiar
               with these systems expect "first match wins."

            4. No role hierarchy maintenance: Role-level priority requires defining and
               maintaining a hierarchy. What if custom roles are added later? First-match
               avoids this complexity entirely.

            Trade-off:
                Misconfigured ordering can accidentally give users lower access than
                intended. This is considered acceptable because it's explicit and
                auditable in the configuration.

            Configuration Best Practice:
                Order mappings from highest privilege to lowest:
                    [
                        {"group_dn": "cn=admins,ou=groups,dc=example,dc=com", "role": "ADMIN"},
                        {"group_dn": "cn=developers,ou=groups,dc=example,dc=com", "role": "MEMBER"},
                        {"group_dn": "*", "role": "VIEWER"}  # Catch-all fallback
                    ]

        Args:
            group_dns: List of LDAP group DNs the user is a member of

        Returns:
            Phoenix role name (ADMIN, MEMBER, VIEWER) or None if no match

        See Also:
            Grafana's equivalent implementation:
            https://github.com/grafana/grafana/blob/main/pkg/services/ldap/ldap.go
            (buildGrafanaUser function, "only use the first match for each org" comment)
        """
        # Normalize user group DNs once to avoid repeated canonicalization
        # Filter out None values (DNs that failed to parse) with warning
        canonical_user_groups: set[str] = set()
        for dn in group_dns:
            canonical = canonicalize_dn(dn)
            if canonical is not None:
                canonical_user_groups.add(canonical)
            else:
                # Log warning but don't include the DN itself (may contain sensitive info)
                logger.warning(
                    "Failed to canonicalize group DN from LDAP server. "
                    "This group will be ignored for role mapping. "
                    "This may indicate malformed data in the LDAP directory."
                )

        # Iterate through mappings in priority order (first match wins)
        for mapping in self.config.group_role_mappings:
            group_dn = mapping["group_dn"]
            role = mapping["role"]

            # Check if user matches this mapping
            if _is_member_of(canonical_user_groups, group_dn):
                return role  # Already validated and normalized to uppercase at config load

        # No matching groups - deny access
        return None


@overload
def _get_attribute(
    entry: Entry, attr_name: str, multiple: Literal[False] = False
) -> str | None: ...


@overload
def _get_attribute(entry: Entry, attr_name: str, multiple: Literal[True]) -> list[str] | None: ...


def _get_attribute(entry: Entry, attr_name: str, multiple: bool = False) -> str | list[str] | None:
    """Safely extract attribute value from LDAP entry.

    Args:
        entry: LDAP entry object
        attr_name: Attribute name to extract
        multiple: If True, return list of values; otherwise return first value

    Returns:
        Attribute value(s) or None if not present
    """
    if not attr_name:
        return None

    attr = getattr(entry, attr_name, None)
    if attr is None:
        return None

    values = attr.values if hasattr(attr, "values") else []
    if not values:
        return None

    if multiple:
        return list(values)
    return str(values[0])


def _get_unique_id(entry: Entry, attr_name: str) -> str | None:
    """Extract unique identifier attribute, handling binary values.

    Different LDAP servers store unique identifiers in different formats:

    - Active Directory objectGUID: Binary (16 bytes, mixed-endian)
    - OpenLDAP entryUUID: String (RFC 4530)
    - 389 DS nsUniqueId: String

    This method handles both binary and string formats, returning a
    standard UUID string representation for consistency.

    IMPORTANT - Database Compatibility:
        The returned string is used as a database key for user lookup.
        To ensure consistent matching:
        - Output is always lowercase (UUIDs are case-insensitive per RFC 4122)
        - Whitespace is stripped
        - Empty values return None

        If an existing database entry has different casing (e.g., uppercase
        from an older version), the user will be found via email fallback
        and their unique_id will be updated on next login.

    Active Directory objectGUID Binary Format (MS-DTYP §2.3.4):
        Microsoft's GUID structure uses mixed-endian byte ordering:

        | Field | Size    | Endianness    | Wire bytes for "2212e4c7-..." |
        |-------|---------|---------------|-------------------------------|
        | Data1 | 4 bytes | Little-endian | c7 e4 12 22                   |
        | Data2 | 2 bytes | Little-endian | 1e 05                         |
        | Data3 | 2 bytes | Little-endian | 0c 4d                         |
        | Data4 | 8 bytes | Big-endian    | 9a 5b 12 77 0a 9b b7 ab       |

        Python's uuid.UUID(bytes_le=...) expects exactly this format.

    References:
        - MS-DTYP §2.3.4: https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-dtyp/001eec5a-7f8b-4293-9e21-ca349392db40
        - MS-ADA3 objectGUID: https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-ada3/937eb5c6-f6b3-4652-a276-5d6bb8979658
        - RFC 4530 entryUUID: https://www.rfc-editor.org/rfc/rfc4530.html

    Args:
        entry: LDAP entry object from ldap3
        attr_name: Attribute name (e.g., "objectGUID", "entryUUID")

    Returns:
        String representation of the unique ID (lowercase UUID format),
        or None if not present or empty
    """  # noqa: E501
    if not attr_name:
        return None

    attr = getattr(entry, attr_name, None)
    if attr is None:
        return None

    # Get raw value - could be bytes (objectGUID) or str (entryUUID)
    # ldap3's decode_raw_vals (search.py:410-411) returns:
    #   - [bytes(val) for val in vals] if vals has items (always bytes, never str)
    #   - None if vals is empty/falsy (NOT an empty list)
    # The `and attr.raw_values` check handles both None and empty list cases.
    raw_value = attr.raw_values[0] if hasattr(attr, "raw_values") and attr.raw_values else None
    if raw_value is None:
        return None

    # Handle binary values (AD objectGUID is 16 bytes)
    # ldap3 always returns bytes, but we accept bytearray/memoryview for defensive coding
    if isinstance(raw_value, (bytes, bytearray, memoryview)):
        raw_bytes = bytes(raw_value)  # Normalize to bytes for uuid.UUID

        # Empty bytes should return None, not empty string
        if len(raw_bytes) == 0:
            return None

        if len(raw_bytes) == 16:
            import uuid

            # ASSUMPTION: 16-byte values are binary UUIDs (e.g., AD objectGUID).
            # Custom 16-character string IDs are NOT supported - see LDAPConfig docs.
            #
            # MS-DTYP §2.3.4: GUID uses mixed-endian format
            # Data1/Data2/Data3 are little-endian, Data4 is big-endian
            # Python's bytes_le parameter handles this correctly
            # Note: uuid.UUID always returns lowercase
            return str(uuid.UUID(bytes_le=raw_bytes))
        else:
            # Non-16-byte value: likely a string UUID (e.g., OpenLDAP entryUUID)
            # OpenLDAP stores entryUUID as string "550e8400-e29b-41d4-a716-446655440000"
            # which comes as bytes b"550e8400-..." (36 bytes) - decode as UTF-8
            try:
                decoded = raw_bytes.decode("utf-8").strip()
                # Return None for empty strings after stripping
                if not decoded:
                    return None
                # Normalize to lowercase for consistent DB lookups
                # (UUIDs are case-insensitive per RFC 4122 §3)
                return decoded.lower()
            except UnicodeDecodeError:
                # Truly binary format we don't recognize - hex encode for safety
                # Hex is already lowercase
                return raw_bytes.hex()

    # String value (shouldn't happen with ldap3, but handle for safety)
    result = str(raw_value).strip()
    return result.lower() if result else None


def _is_member_of(canonical_user_groups: set[str], target_group: str) -> bool:
    """Check if user is member of LDAP group.

    Matching logic:
    - Wildcard "*" matches all users (useful for default roles)
    - Case-insensitive DN comparison per RFC 4514
    - Canonical DN comparison to account for spacing/order/escape differences

    Args:
        canonical_user_groups: Set of canonicalized group DNs the user is a member of
        target_group: Target group DN to check (or "*" for wildcard)

    Returns:
        True if user is a member of the target group, False otherwise.
        Returns False if target_group cannot be canonicalized (configuration error).
    """
    # Wildcard matches everyone
    if target_group == "*":
        return True

    # Canonical comparison handles ordering/spacing/escaping differences
    target_canonical = canonicalize_dn(target_group)
    if target_canonical is None:
        # Configuration error: admin-provided group DN in PHOENIX_LDAP_GROUP_ROLE_MAPPINGS
        # cannot be parsed. Log error and return False (no match) to fail safely.
        logger.error(
            "Failed to canonicalize configured group DN in PHOENIX_LDAP_GROUP_ROLE_MAPPINGS. "
            "This mapping will never match. Check DN syntax in configuration."
        )
        return False

    return target_canonical in canonical_user_groups
