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

See Also:
    _create_servers(): Server-level TLS configuration (use_ssl, tls)
    _establish_connection(): Connection-level TLS upgrade (AUTO_BIND modes)
    _verify_user_password(): Manual TLS upgrade sequencing
"""

from __future__ import annotations

import logging
import ssl
from secrets import token_hex
from typing import Any, Final, Literal, NamedTuple, Optional, overload

import anyio
from ldap3 import (
    ALL,
    AUTO_BIND_DEFAULT,
    AUTO_BIND_NO_TLS,
    AUTO_BIND_TLS_BEFORE_BIND,
    SUBTREE,
    Connection,
    Server,
    Tls,
)
from ldap3.core.exceptions import LDAPException, LDAPInvalidDnError
from ldap3.utils.conv import escape_filter_chars
from ldap3.utils.dn import parse_dn

from phoenix.config import LDAPConfig

logger = logging.getLogger(__name__)


def canonicalize_dn(dn: str) -> str:
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
             If DN parsing fails, returns simple lowercase of input string (graceful degradation).

    Examples:
        >>> canonicalize_dn("cn=John,ou=Users,dc=Example,dc=com")
        'cn=john,ou=users,dc=example,dc=com'

        >>> canonicalize_dn("CN=john+EMAIL=john@corp.com,OU=users,DC=example,DC=com")
        'cn=john+email=john@corp.com,ou=users,dc=example,dc=com'

        >>> canonicalize_dn("email=john@corp.com+cn=John,ou=Users,dc=Example,dc=com")
        'cn=john+email=john@corp.com,ou=users,dc=example,dc=com'  # Sorted

    References:
        RFC 4514 Section 4: String representation of DNs are case-insensitive
        ldap3 parse_dn(): Validates syntax and decomposes into components
    """
    try:
        # Parse DN with escaping and whitespace stripping
        components = parse_dn(dn, escape=True, strip=True)
    except LDAPInvalidDnError:
        # Graceful degradation: if parse fails, use simple lowercase
        # Prevents authentication failure for malformed DNs
        logger.warning(f"Failed to parse DN for canonicalization, using simple lowercase: {dn}")
        return dn.lower()

    # Build canonical DN
    canonical_parts = []
    current_rdn_components = []

    for attr_type, attr_value, separator in components:
        # Normalize attribute type and value to lowercase
        normalized_component = (attr_type.lower(), attr_value.lower())
        current_rdn_components.append(normalized_component)

        # When we hit a comma (or end), we've completed an RDN
        if separator == "," or separator == "":
            # Sort multi-valued RDN components alphabetically for deterministic output
            # Example: "email=x+cn=y" and "cn=y+email=x" both become "cn=y+email=x"
            current_rdn_components.sort(key=lambda x: x[0])

            # Format the RDN
            rdn_str = "+".join(f"{attr}={value}" for attr, value in current_rdn_components)
            canonical_parts.append(rdn_str)

            # Reset for next RDN
            current_rdn_components = []

    return ",".join(canonical_parts)


# Unicode marker for identifying LDAP users in oauth2_client_id column
# U+E000 from Private Use Area - guaranteed never to be assigned by Unicode Standard
LDAP_CLIENT_ID_MARKER: Final[str] = "\ue000LDAP(stopgap)"


def is_ldap_user(oauth2_client_id: str | None) -> bool:
    """Check if an oauth2_client_id indicates an LDAP user.

    Args:
        oauth2_client_id: The OAuth2 client ID to check (can be None)

    Returns:
        True if the client ID indicates an LDAP user, False otherwise
    """
    return bool(oauth2_client_id and oauth2_client_id.startswith(LDAP_CLIENT_ID_MARKER))


class LDAPUserInfo(NamedTuple):
    """Authenticated LDAP user information."""

    email: str
    display_name: str
    groups: list[str]
    user_dn: str
    ldap_username: str
    role: str


class LDAPAuthenticator:
    """Handles LDAP authentication and user attribute retrieval.

    Supports both Active Directory and OpenLDAP:
    - Active Directory: Uses memberOf attribute for group membership
    - OpenLDAP/POSIX: Uses group search with member attribute
    - Multi-server failover for high availability
    - TLS/LDAPS with certificate validation (RFC 4513)
    - Group-based role mapping with wildcard support
    """

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
            Phoenix supports three LDAP connection modes:

            1. LDAPS (TLS from start, port 636):
                - use_tls=True, tls_mode="ldaps"
                - Server: use_ssl=True, tls=<Tls config>
                - TLS established at TCP connection layer (like HTTPS)
                - Bind credentials encrypted from the start
                - No start_tls() call needed

            2. STARTTLS (upgrade from plaintext, port 389):
                - use_tls=True, tls_mode="starttls"
                - Server: use_ssl=False, tls=<Tls config>
                - Connection starts plaintext, upgraded to TLS via start_tls()
                - Bind credentials encrypted ONLY after start_tls() completes
                - CRITICAL: Must call start_tls() before bind (see _establish_connection)

            3. Plaintext (no encryption, testing only):
                - use_tls=False
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
        hosts = [h.strip() for h in self.config.host.split(",")]

        tls_config = None
        if self.config.use_tls:
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
        for host in hosts:
            server = Server(
                host,
                port=self.config.port,
                use_ssl=(self.config.use_tls and self.config.tls_mode == "ldaps"),
                tls=tls_config,
                connect_timeout=10,
                get_info=ALL,
            )
            servers.append(server)

        return servers

    def _establish_connection(self, server: Server) -> Connection:
        """Establish a connection to the LDAP server.

        Connection Flow by TLS Mode:
            STARTTLS Mode (use_tls=True, tls_mode="starttls"):
                1. Open plaintext TCP connection (port 389)
                2. Send Extended Request to upgrade to TLS
                3. Perform TLS handshake
                4. Send bind credentials (now encrypted)

                Implementation: Use AUTO_BIND_TLS_BEFORE_BIND to ensure step 2-3
                happen before step 4.

            LDAPS Mode (use_tls=True, tls_mode="ldaps"):
                1. Establish TLS connection (port 636)
                2. Send bind credentials (already encrypted)

                Implementation: Use AUTO_BIND_NO_TLS (TLS already active from Server)

            Plaintext Mode (use_tls=False):
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
        if self.config.use_tls and self.config.tls_mode == "starttls":
            auto_bind_mode = AUTO_BIND_TLS_BEFORE_BIND
        else:
            # LDAPS: TLS already active via use_ssl=True on Server, bind normally
            # Plaintext: No TLS, bind normally
            auto_bind_mode = AUTO_BIND_NO_TLS

        if self.config.bind_dn and self.config.bind_password:
            return Connection(
                server,
                user=self.config.bind_dn,
                password=self.config.bind_password,
                auto_bind=auto_bind_mode,
                raise_exceptions=True,
                receive_timeout=30,  # Timeout for LDAP operations (bind, search)
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
        )
        try:
            conn.open()

            # Upgrade to TLS for STARTTLS mode before any bind operations
            if self.config.use_tls and self.config.tls_mode == "starttls":
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

    async def authenticate(self, username: str, password: str) -> Optional[LDAPUserInfo]:
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

            Timeouts (Defense-in-Depth):
            - Connection establishment: 10 seconds (Server connect_timeout)
              Rationale: Network unreachable or firewall block should fail fast
            - LDAP operations: 30 seconds per operation (Connection receive_timeout)
              Rationale: Bind/search should complete quickly; slow response indicates
              server overload or network issues. Prevents thread from hanging indefinitely.
            - HTTP request timeout: 60 seconds (anyio.fail_after - returns 500 to client,
              but thread continues until socket timeout)
              Rationale: Prevents client from hanging, but cannot stop thread itself
              (Python threads running native C code cannot be cancelled)

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
            LDAPUserInfo object or None if authentication fails

        Raises:
            LDAPException: If LDAP server communication fails or times out
        """
        # Run synchronous ldap3 operations in thread pool to avoid blocking event loop
        # Note: fail_after() prevents HTTP request hang but cannot stop the thread itself
        # (threads running native code cannot be cancelled). Real timeout is receive_timeout=30
        # on Connection objects, which terminates blocking socket operations inside the thread.
        with anyio.fail_after(60):
            return await anyio.to_thread.run_sync(self._authenticate, username, password)

    def _authenticate(self, username: str, password: str) -> Optional[LDAPUserInfo]:
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

        # SECURITY: Prevent LDAP filter injection (RFC 4515)
        # Attack: username="*" or "admin*" or "admin)(uid=*" could bypass authentication
        # or enumerate users. escape_filter_chars() escapes special LDAP filter characters:
        # * → \2a, ( → \28, ) → \29, \ → \5c, NUL → \00
        escaped_username = escape_filter_chars(username)

        for server in self.servers:
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
                        logger.debug("User not found in LDAP directory")

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
                        #
                        # 3. TIMING ATTACK CONSIDERATION:
                        #    Trying multiple servers would also introduce a timing side-channel:
                        #      - User on server A: search(A) + bind(A) → ~150ms
                        #      - User on server B: search(A) + dummy(A) + search(B) + bind(B) → ~300ms
                        #    Attackers could potentially infer which server contains the user.
                        #    The current design provides consistent timing regardless of user
                        #    existence, which is a security benefit (though not the primary driver).
                        #
                        # If multi-server search is required for your environment, consider:
                        #   - Ensuring replicas are consistent before routing authentication traffic
                        #   - Using a load balancer that routes to consistent replicas
                        #   - Implementing application-level retry with exponential backoff
                        return None

                    user_dn = user_entry.entry_dn

                    # Step 4: Authenticate user by binding with their credentials
                    # We use a separate connection to verify the password to avoid
                    # dropping the main connection which might be needed for group search.
                    if not self._verify_user_password(server, user_dn, password):
                        logger.debug("LDAP password verification failed")
                        return None

                    # Step 5: Extract user attributes
                    email = self._get_attribute(user_entry, self.config.attr_email)
                    if not email:
                        logger.error(
                            f"LDAP user missing required email attribute "
                            f"({self.config.attr_email}). Check LDAP schema configuration."
                        )
                        return None

                    display_name = self._get_attribute(user_entry, self.config.attr_display_name)

                    # Step 6: Get user's group memberships
                    # Reuses the existing service/anonymous connection
                    groups = self._get_user_groups(conn, user_entry, user_dn)

                    # Step 7: Map groups to Phoenix role
                    role = self.map_groups_to_role(groups)
                    if not role:
                        logger.debug(
                            "LDAP user has no matching groups for role assignment. "
                            "Check PHOENIX_LDAP_GROUP_ROLE_MAPPINGS configuration."
                        )
                        return None

                    return LDAPUserInfo(
                        email=email,
                        display_name=display_name or email.split("@")[0],
                        groups=groups,
                        user_dn=user_dn,
                        ldap_username=username,
                        role=role,
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

    def _search_user(self, conn: Connection, escaped_username: str) -> Optional[Any]:
        """Search for user in LDAP directory.

        Args:
            conn: Active LDAP connection
            escaped_username: Escaped username for filter

        Returns:
            User entry or None if not found or ambiguous
        """
        user_filter = self.config.user_search_filter.replace("%s", escaped_username)
        # Use the search base as-is (it's a DN that contains commas)
        conn.search(
            search_base=self.config.user_search_base,
            search_filter=user_filter,
            search_scope=SUBTREE,
            attributes=[
                self.config.attr_email,
                self.config.attr_display_name,
                self.config.attr_member_of,
            ],
        )

        # Handle search results
        if len(conn.entries) == 0:
            logger.info("LDAP user search returned no results")
            return None
        elif len(conn.entries) > 1:
            # SECURITY: Reject ambiguous results to prevent non-deterministic authentication
            # Attack scenario: Username "jsmith" exists in both ou=contractors,dc=corp and
            # ou=employees,dc=corp. Blindly taking first result means authentication outcome
            # depends on LDAP server's arbitrary ordering (could change between queries).
            # This allows an attacker to exploit timing or replica inconsistencies.
            # Proper fix: Use more specific user_search_base or filter to ensure uniqueness.
            logger.error(
                f"Ambiguous LDAP search: found {len(conn.entries)} matching entries. "
                f"Rejecting authentication for safety. "
                f"Fix: Use more specific user_search_filter or user_search_base to "
                f"ensure unique results."
            )
            return None

        # Exactly one match - success
        return conn.entries[0]

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

        Args:
            server: Server object with TLS pre-configured.
            user_dn: User's Distinguished Name (e.g., "uid=alice,ou=users,dc=example,dc=com").
            password: User's password to verify.

        Returns:
            bool: True if bind succeeds (password valid), False otherwise.
        """
        user_conn = Connection(
            server,
            user=user_dn,
            password=password,
            auto_bind=False,
            raise_exceptions=True,
            receive_timeout=30,  # Timeout for bind operation
        )
        try:
            user_conn.open()
            # CRITICAL: Upgrade to TLS BEFORE sending password for STARTTLS mode
            if self.config.use_tls and self.config.tls_mode == "starttls":
                user_conn.start_tls()
            user_conn.bind()
            return user_conn.bound
        finally:
            # CRITICAL: Always unbind to prevent socket leak
            # Threat: If open() or start_tls() or bind() raises, connection has an open
            # socket but bound=False. Conditional cleanup (if user_conn.bound: unbind())
            # would skip cleanup, leaking the file descriptor. Repeated failed logins
            # would exhaust process FD limit (typically 1024) causing service crash.
            # unbind() safely closes socket regardless of bind state.
            user_conn.unbind()  # type: ignore[no-untyped-call]

    def _get_user_groups(self, conn: Connection, user_entry: Any, user_dn: str) -> list[str]:
        """Get user's group memberships.

        Supports two methods:
        1. Active Directory: Read memberOf attribute directly
        2. POSIX/OpenLDAP: Search for groups that contain the user

        Args:
            conn: Active LDAP connection (with service account if configured)
            user_entry: User entry from search
            user_dn: User's distinguished name

        Returns:
            List of group DNs
        """
        groups: list[str] = []

        # Method 1: Active Directory memberOf attribute
        if self.config.attr_member_of:
            member_of = self._get_attribute(user_entry, self.config.attr_member_of, multiple=True)
            if member_of:
                groups.extend(member_of)

        # Method 2: POSIX group search
        if self.config.group_search_base and self.config.group_search_filter:
            # SECURITY: Escape user DN for LDAP filter (RFC 4515)
            # Threat: DNs can contain special chars like parentheses, asterisks, backslashes
            # (e.g., "cn=user(contractor)*,ou=users"). If inserted into filter unescaped,
            # these could break filter syntax or allow injection. Always escape before
            # string substitution, even though DN comes from trusted LDAP server.
            escaped_dn = escape_filter_chars(user_dn)
            group_filter = self.config.group_search_filter.replace("%s", escaped_dn)

            try:
                conn.search(
                    search_base=self.config.group_search_base,
                    search_filter=group_filter,
                    search_scope=SUBTREE,
                    attributes=["cn"],
                )
                for group_entry in conn.entries:
                    groups.append(group_entry.entry_dn)
            except LDAPException as e:
                # SECURITY: Don't leak internal LDAP server error details
                logger.warning(f"LDAP group search failed. Error type: {type(e).__name__}")

        return groups

    @overload
    def _get_attribute(
        self, entry: Any, attr_name: str, multiple: Literal[False] = False
    ) -> Optional[str]: ...

    @overload
    def _get_attribute(
        self, entry: Any, attr_name: str, multiple: Literal[True]
    ) -> Optional[list[str]]: ...

    def _get_attribute(
        self, entry: Any, attr_name: str, multiple: bool = False
    ) -> Optional[str | list[str]]:
        """Safely extract attribute value from LDAP entry.

        Args:
            entry: LDAP entry object
            attr_name: Attribute name to extract
            multiple: If True, return list of values; otherwise return first value

        Returns:
            Attribute value(s) or None if not present
        """
        if not hasattr(entry, attr_name):
            return None

        attr = getattr(entry, attr_name)
        if not attr:
            return None

        values = attr.values if hasattr(attr, "values") else []
        if not values:
            return None

        if multiple:
            return values
        return values[0] if values else None

    def map_groups_to_role(self, group_dns: list[str]) -> Optional[str]:
        """Map LDAP group DNs to Phoenix role.

        Mapping behavior:
        - Iterates through mappings in order (first match wins)
        - Supports wildcard "*" to match all users
        - Case-insensitive DN matching per RFC 4514
        - Simple string comparison (no DN normalization)

        Args:
            group_dns: List of LDAP group DNs the user is a member of

        Returns:
            Phoenix role name (ADMIN, MEMBER, VIEWER) or None if no match
        """
        # Iterate through mappings in priority order (first match wins)
        for mapping in self.config.group_role_mappings:
            group_dn = mapping["group_dn"]
            role = mapping["role"]

            # Check if user matches this mapping
            if self._is_member_of(group_dns, group_dn):
                return self._validate_phoenix_role(role)

        # No matching groups - deny access
        return None

    def _validate_phoenix_role(self, role: str) -> str:
        """Validate and normalize Phoenix role names.

        Phoenix roles: ADMIN, MEMBER, VIEWER (case-insensitive input, uppercase output)

        Args:
            role: Phoenix role name (case-insensitive)

        Returns:
            Normalized Phoenix role name (uppercase)
        """
        normalized = role.upper()
        valid_roles = {"ADMIN", "MEMBER", "VIEWER"}
        if normalized in valid_roles:
            return normalized
        # Default to MEMBER if invalid
        logger.warning(f"Invalid role '{role}' in group mapping, defaulting to MEMBER")
        return "MEMBER"

    def _is_member_of(self, user_groups: list[str], target_group: str) -> bool:
        """Check if user is member of LDAP group.

        Matching logic:
        - Wildcard "*" matches all users (useful for default roles)
        - Case-insensitive DN comparison per RFC 4514
        - Simple string match without DN normalization

        Args:
            user_groups: List of group DNs the user is a member of
            target_group: Target group DN to check (or "*" for wildcard)

        Returns:
            True if user is a member of the target group
        """
        # Wildcard matches everyone
        if target_group == "*":
            return True

        # Case-insensitive string comparison
        target_lower = target_group.lower()
        for group in user_groups:
            if group.lower() == target_lower:
                return True

        return False
