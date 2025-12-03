"""Mock LDAP server for integration testing.

This module provides a lightweight LDAP server implementing minimal RFC 4511
operations (Bind, Search) for Phoenix authentication testing. The server runs
in a separate thread and handles real LDAP protocol connections.

Design Principles:
- Maximum logging for debuggability (not production code)
- Simple, readable structure over performance
- Clear separation of protocol handling vs. business logic
"""

from __future__ import annotations

import logging
import socketserver
import threading
from dataclasses import dataclass, field
from types import TracebackType
from typing import Any, Optional, Type

from ldap3.core.exceptions import LDAPInvalidDnError
from ldap3.protocol.rfc4511 import (
    BindResponse,
    LDAPMessage,
    PartialAttribute,
    PartialAttributeList,
    ProtocolOp,
    SearchResultDone,
    SearchResultEntry,
    Vals,
)
from ldap3.utils.dn import parse_dn
from pyasn1.codec.ber import decoder, encoder
from typing_extensions import Self

from phoenix.server.ldap import canonicalize_dn

# Configure debug logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


@dataclass
class LDAPUser:
    """LDAP directory entry for a user."""

    username: str
    password: str
    email: str
    display_name: str
    groups: list[str] = field(default_factory=list)
    custom_dn: Optional[str] = None

    @property
    def dn(self) -> str:
        """User's distinguished name."""
        if self.custom_dn:
            return self.custom_dn
        return f"uid={self.username},ou=users,dc=example,dc=com"

    def matches_credentials(self, dn: str, password: str) -> bool:
        """Check if provided credentials match this user (RFC 4514 canonical comparison)."""
        return canonicalize_dn(self.dn) == canonicalize_dn(dn) and self.password == password


@dataclass
class LDAPGroup:
    """LDAP directory entry for a POSIX group.

    Used for testing POSIX group searches where groups store member DNs
    in a 'member' attribute (unlike Active Directory's memberOf).
    """

    cn: str  # Common name (group name)
    members: list[str] = field(default_factory=list)  # List of member DNs

    @property
    def dn(self) -> str:
        """Group's distinguished name."""
        return f"cn={self.cn},ou=groups,dc=example,dc=com"


class _LDAPServer:
    """Mock LDAP server for integration testing.

    Implements minimal LDAP protocol (RFC 4511) for authentication testing:
    - Bind operation for authentication
    - Search operation for user lookup
    - Group membership queries

    Usage:
        with _LDAPServer(port=3899) as server:
            server.add_user("jdoe", "pass123", "jdoe@example.com", "John Doe",
                           groups=["cn=admins,ou=groups,dc=example,dc=com"])
            # Server available at ldap://127.0.0.1:3899
    """

    def __init__(self, port: int):
        """Initialize mock LDAP server.

        Args:
            port: TCP port to listen on
        """
        self._port = port
        self._host = "127.0.0.1"
        self._base_dn = "dc=example,dc=com"
        self._bind_dn = "cn=admin,dc=example,dc=com"
        self._bind_password = "admin_password"

        # User directory (keyed by DN to support duplicate usernames in different OUs)
        self._users: dict[str, LDAPUser] = {}

        # Group directory (for POSIX group searches)
        self._groups: dict[str, LDAPGroup] = {}

        # Server infrastructure
        self._server: Optional[socketserver.ThreadingTCPServer] = None
        self._thread: Optional[threading.Thread] = None

        logger.info(f"Initializing mock LDAP server on {self._host}:{self._port}")

    def add_user(
        self,
        username: str,
        password: str,
        email: str,
        display_name: str,
        groups: Optional[list[str]] = None,
        custom_dn: Optional[str] = None,
    ) -> str:
        """Add or update a user in the mock directory.

        Args:
            username: User's username (uid or sAMAccountName)
            password: User's password for bind authentication
            email: User's email address
            display_name: User's display name
            groups: List of group DNs the user belongs to
            custom_dn: Optional custom DN (for testing duplicate usernames in different OUs)

        Returns:
            User's distinguished name (DN)

        Note:
            DNs are stored with normalized (lowercase) keys per RFC 4514 (case-insensitive).
            This allows the same user to be updated even if DN casing differs across calls.
        """
        user = LDAPUser(username, password, email, display_name, groups or [], custom_dn)
        # Store by canonical DN per RFC 4514 (handles case, whitespace, multi-valued RDN ordering)
        # This ensures the same user can be updated even if DN formatting differs
        dn_canonical = canonicalize_dn(user.dn)
        self._users[dn_canonical] = user
        logger.debug(
            f"Added user: {username} (dn={user.dn}, canonical_key={dn_canonical}, "
            f"email={email}, groups={len(user.groups)})"
        )
        return user.dn

    @property
    def host(self) -> str:
        """LDAP server hostname."""
        return self._host

    @property
    def port(self) -> int:
        """LDAP server port."""
        return self._port

    @property
    def url(self) -> str:
        """LDAP server URL."""
        return f"ldap://{self._host}:{self._port}"

    @property
    def bind_dn(self) -> str:
        """Service account bind DN."""
        return self._bind_dn

    @property
    def bind_password(self) -> str:
        """Service account bind password."""
        return self._bind_password

    @property
    def user_search_base(self) -> str:
        """Base DN for user searches."""
        return f"ou=users,{self._base_dn}"

    @property
    def group_search_base(self) -> str:
        """Base DN for group searches (POSIX)."""
        return f"ou=groups,{self._base_dn}"

    def add_group(self, cn: str, members: Optional[list[str]] = None) -> str:
        """Add or update a POSIX group in the mock directory.

        Args:
            cn: Group's common name (e.g., "admins", "developers")
            members: List of member DNs (e.g., ["uid=jdoe,ou=users,dc=example,dc=com"])

        Returns:
            Group's distinguished name (DN)
        """
        group = LDAPGroup(cn, members or [])
        self._groups[cn] = group
        logger.debug(f"Added group: {cn} (dn={group.dn}, members={len(group.members)})")
        return group.dn

    def clear_all_users(self) -> None:
        """Clear all users and groups from the mock directory.

        This is used for test isolation to ensure each test starts with a clean slate.
        """
        self._users.clear()
        self._groups.clear()
        logger.debug("Cleared all users and groups from mock LDAP server")

    def __enter__(self) -> Self:
        """Start the LDAP server."""
        logger.info(f"Starting mock LDAP server at {self.url}")

        # Create request handler with access to this server's state
        class Handler(_LDAPRequestHandler):
            ldap_server = self

        # Use ThreadingTCPServer for concurrent connection handling
        # This allows multiple LDAP clients to connect simultaneously
        socketserver.ThreadingTCPServer.allow_reuse_address = True
        self._server = socketserver.ThreadingTCPServer((self._host, self._port), Handler)

        # Run server in background thread
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()

        logger.info(f"Mock LDAP server listening on {self.url}")
        return self

    def __exit__(
        self,
        exc_type: Optional[Type[BaseException]],
        exc_val: Optional[BaseException],
        exc_tb: Optional[TracebackType],
    ) -> None:
        """Stop the LDAP server."""
        logger.info("Shutting down mock LDAP server")
        if self._server:
            self._server.shutdown()
            self._server.server_close()
        if self._thread:
            self._thread.join(timeout=1.0)
        logger.info("Mock LDAP server stopped")


class _LDAPRequestHandler(socketserver.BaseRequestHandler):
    """TCP request handler for LDAP protocol messages.

    Processes incoming LDAP messages (Bind, Search) and sends responses.
    Each connection gets its own handler instance.
    """

    ldap_server: _LDAPServer  # Set by __enter__

    def handle(self) -> None:
        """Process LDAP protocol messages from client.

        Handles multiple messages in sequence until client disconnects.
        """
        logger.info(f"New LDAP connection from {self.client_address}")

        while True:
            try:
                # Read length-prefixed LDAP message
                raw_message = self._read_ldap_message()
                if not raw_message:
                    logger.debug("Client closed connection")
                    break

                logger.debug(f"Received {len(raw_message)} bytes")

                # Decode LDAP message
                message, _ = decoder.decode(raw_message, asn1Spec=LDAPMessage())
                message_id = int(message["messageID"])
                operation = message["protocolOp"]
                operation_name = operation.getName()

                logger.info(f"Message {message_id}: {operation_name}")

                # Route to appropriate handler
                if operation_name == "bindRequest":
                    self._handle_bind(message_id, operation)
                elif operation_name == "searchRequest":
                    self._handle_search(message_id, operation)
                elif operation_name == "unbindRequest":
                    logger.info("Received unbind request, closing connection")
                    break
                else:
                    logger.warning(f"Unsupported operation: {operation_name}")

            except Exception as e:
                logger.exception(f"Error handling LDAP request: {e}")
                break

        logger.debug("Connection handler finished")

    def _read_ldap_message(self) -> bytes:
        """Read a complete BER-encoded LDAP message from the socket.

        LDAP messages are BER-encoded with format:
        - Tag (1 byte): 0x30 (SEQUENCE)
        - Length (1+ bytes): Message length
        - Value (N bytes): Message content

        Returns:
            Complete BER message bytes
        """
        # Read tag
        tag = self.request.recv(1)
        if not tag:
            return b""

        # Read length (supports multi-byte lengths per BER)
        length_bytes_raw = self.request.recv(1)
        if not length_bytes_raw:
            return b""
        length_byte = length_bytes_raw[0]
        if length_byte & 0x80:
            # Multi-byte length
            num_length_bytes = length_byte & 0x7F
            length_bytes = self.request.recv(num_length_bytes)
            length = int.from_bytes(length_bytes, "big")
            header = tag + bytes([length_byte]) + length_bytes
        else:
            # Single-byte length
            length = length_byte
            header = tag + bytes([length_byte])

        # Read message body
        body = self.request.recv(length)

        logger.debug(f"Read message: tag={tag.hex()}, length={length}, body={len(body)} bytes")
        result: bytes = header + body
        return result

    def _handle_bind(self, message_id: int, bind_request: ProtocolOp) -> None:
        """Handle LDAP bind request (authentication).

        Args:
            message_id: LDAP message ID
            bind_request: Decoded bind request operation
        """
        # Extract actual BindRequest from ProtocolOp
        bind_req = bind_request.getComponentByName("bindRequest")
        bind_dn = str(bind_req.getComponentByPosition(1))  # name is position 1
        auth_choice = bind_req.getComponentByPosition(2)  # authentication is position 2

        # Extract password from simple authentication
        password = ""
        if auth_choice.getName() == "simple":
            password = str(auth_choice.getComponent())

        logger.info(f"Bind request: dn={bind_dn}")
        logger.debug(f"Bind credentials: dn={bind_dn}, password={'*' * len(password)}")

        # Check credentials
        success = self._authenticate(bind_dn, password)

        result_code = 0 if success else 49  # success=0, invalidCredentials=49
        logger.info(f"Bind result: code={result_code} ({'success' if success else 'failed'})")

        # Send bind response
        response = self._create_bind_response(message_id, result_code)
        self.request.sendall(encoder.encode(response))

    def _authenticate(self, dn: str, password: str) -> bool:
        """Authenticate user credentials.

        Args:
            dn: Bind DN
            password: Bind password

        Returns:
            True if credentials are valid
        """
        # Check service account (RFC 4514 canonical comparison)
        if canonicalize_dn(dn) == canonicalize_dn(self.ldap_server._bind_dn):
            valid = password == self.ldap_server._bind_password
            logger.debug(f"Service account auth: {valid}")
            return valid

        # Check user accounts (users keyed by DN)
        for user_dn, user in self.ldap_server._users.items():
            if user.matches_credentials(dn, password):
                logger.debug(f"User auth success: {user.username} (dn={user_dn})")
                return True

        logger.debug("Auth failed: no matching credentials")
        return False

    def _validate_dn(self, dn: str) -> bool:
        """Validate DN syntax using ldap3's parser.

        This ensures the mock server behaves like a real LDAP server by rejecting
        malformed DNs (e.g., "ou=users" instead of "ou=users,dc=example,dc=com").

        Args:
            dn: Distinguished Name to validate

        Returns:
            True if DN is syntactically valid, False otherwise
        """
        # Empty DN is valid (represents root DSE)
        if not dn:
            logger.debug("DN validation passed: <empty> (root DSE)")
            return True

        try:
            # Use ldap3's DN parser to validate syntax
            parse_dn(dn)
            logger.debug(f"DN validation passed: {dn}")
            return True
        except LDAPInvalidDnError as e:
            logger.warning(f"DN validation failed for '{dn}': {e}")
            return False

    def _handle_search(self, message_id: int, search_request: ProtocolOp) -> None:
        """Handle LDAP search request.

        Supports two types of searches:
        1. User search: (uid=username) or (&(objectClass=person)(uid=username))
        2. Group search: (member=<user-dn>) for POSIX groups

        Args:
            message_id: LDAP message ID
            search_request: Decoded search request operation
        """
        # Extract actual SearchRequest from ProtocolOp
        search_req = search_request.getComponentByName("searchRequest")
        search_base = str(search_req.getComponentByPosition(0))  # baseObject (DN)
        filter_component = search_req.getComponentByPosition(6)  # filter is position 6

        # Filter is a Choice type - get the actual filter content
        filter_name = filter_component.getName()
        logger.debug(f"Filter type: {filter_name}, search base: {search_base}")

        # Validate DN syntax (like a real LDAP server would)
        if not self._validate_dn(search_base):
            logger.warning(f"Invalid DN syntax: {search_base}")
            # Return invalidDnSyntax error (34) like a real LDAP server (OpenLDAP behavior)
            # See OpenLDAP servers/slapd/search.c line 113-118: dnPrettyNormal() validates DN
            # and returns LDAP_INVALID_DN_SYNTAX (0x22 = 34) on failure
            self._send_search_done(message_id, result_code=34, matched_count=0)
            return

        # Determine if this is a user search or group search based on search base
        is_group_search = "ou=groups" in search_base.lower()

        if is_group_search:
            self._handle_group_search(message_id, filter_component, filter_name)
        else:
            self._handle_user_search(message_id, filter_component, filter_name)

    def _handle_user_search(self, message_id: int, filter_component: Any, filter_name: str) -> None:
        """Handle user search request.

        Args:
            message_id: LDAP message ID
            filter_component: ASN.1 filter component
            filter_name: Filter type name
        """
        # Extract username directly from ASN.1 structure (avoids parsing edge cases)
        username: Optional[str] = None

        if filter_name == "equalityMatch":
            # Simple equality filter: (uid=username) or (sAMAccountName=username)
            equality_filter = filter_component.getComponent()
            attr_name = str(equality_filter.getComponentByPosition(0))  # attributeDesc
            attr_value = str(equality_filter.getComponentByPosition(1))  # assertionValue
            logger.info(f"User search: filter=({attr_name}={attr_value})")

            # Support both uid (OpenLDAP) and sAMAccountName (Active Directory)
            if attr_name in ("uid", "sAMAccountName"):
                username = attr_value
        elif filter_name == "and":
            # AND filter: (&(objectClass=person)(uid=username))
            # or (&(objectClass=user)(sAMAccountName=username))  <- Active Directory
            and_filter = filter_component.getComponent()
            logger.info(f"User search: filter=(&...{len(and_filter)} sub-filters)")

            # Find uid or sAMAccountName equality match within AND filter
            for sub_filter in and_filter:
                if sub_filter.getName() == "equalityMatch":
                    eq = sub_filter.getComponent()
                    attr_name = str(eq.getComponentByPosition(0))
                    # Support both uid (OpenLDAP) and sAMAccountName (Active Directory)
                    if attr_name in ("uid", "sAMAccountName"):
                        username = str(eq.getComponentByPosition(1))
                        logger.debug(f"Extracted {attr_name} from AND filter: {username}")
                        break
        else:
            # Other filter types (present, substring, etc.)
            logger.info(f"User search: filter=({filter_name})")

        # Validate username
        if not username:
            logger.warning(f"No uid/sAMAccountName found in filter (type: {filter_name})")
            self._send_search_done(message_id, result_code=0, matched_count=0)
            return

        logger.debug(f"Looking up user: {username}")

        # Look up users matching username (may return multiple for duplicate usernames)
        matching_users = [
            user for user in self.ldap_server._users.values() if user.username == username
        ]

        if not matching_users:
            logger.info(f"User not found: {username}")
            self._send_search_done(message_id, result_code=0, matched_count=0)
            return

        logger.info(
            f"Found {len(matching_users)} user(s) matching '{username}': "
            f"DNs={[u.dn for u in matching_users]}"
        )

        # Send search result entries for ALL matching users (mimics real LDAP behavior)
        for user in matching_users:
            entry = self._create_user_search_entry(message_id, user)
            self.request.sendall(encoder.encode(entry))
            logger.debug(f"Sent search entry for {user.username} (dn={user.dn})")

        # Send search done
        self._send_search_done(message_id, result_code=0, matched_count=len(matching_users))

    def _handle_group_search(
        self, message_id: int, filter_component: Any, filter_name: str
    ) -> None:
        """Handle POSIX group search request.

        Searches for groups where a specific user is a member.
        Typical filter: (member=uid=jdoe,ou=users,dc=example,dc=com)

        Args:
            message_id: LDAP message ID
            filter_component: ASN.1 filter component
            filter_name: Filter type name
        """
        member_dn: Optional[str] = None

        if filter_name == "equalityMatch":
            # POSIX group filter: (member=<user-dn>)
            equality_filter = filter_component.getComponent()
            attr_name = str(equality_filter.getComponentByPosition(0))  # attributeDesc
            attr_value = str(equality_filter.getComponentByPosition(1))  # assertionValue
            logger.info(f"Group search: filter=({attr_name}={attr_value})")

            if attr_name == "member":
                member_dn = attr_value
        else:
            logger.info(f"Group search: unsupported filter type={filter_name}")

        if not member_dn:
            logger.warning(f"No member DN found in group filter (type: {filter_name})")
            self._send_search_done(message_id, result_code=0, matched_count=0)
            return

        # Normalize DN for case-insensitive comparison
        member_dn_lower = member_dn.lower()
        logger.debug(f"Looking up groups with member: {member_dn}")

        # Find all groups containing this member
        matching_groups = [
            group
            for group in self.ldap_server._groups.values()
            if any(m.lower() == member_dn_lower for m in group.members)
        ]

        if not matching_groups:
            logger.info(f"No groups found for member: {member_dn}")
            self._send_search_done(message_id, result_code=0, matched_count=0)
            return

        logger.info(f"Found {len(matching_groups)} group(s) for member: {member_dn}")

        # Send search result entry for each group
        for group in matching_groups:
            entry = self._create_group_search_entry(message_id, group)
            self.request.sendall(encoder.encode(entry))
            logger.debug(f"Sent group entry for {group.cn}")

        # Send search done
        self._send_search_done(message_id, result_code=0, matched_count=len(matching_groups))

    def _create_bind_response(self, message_id: int, result_code: int) -> LDAPMessage:
        """Create LDAP bind response message.

        Args:
            message_id: Message ID to respond to
            result_code: LDAP result code (0=success, 49=invalidCredentials)

        Returns:
            Encoded bind response message
        """
        bind_response = BindResponse()
        bind_response.setComponentByPosition(0, result_code)  # resultCode
        bind_response.setComponentByPosition(1, "")  # matchedDN
        bind_response.setComponentByPosition(2, "")  # diagnosticMessage

        protocol_op = ProtocolOp()
        protocol_op.setComponentByName("bindResponse", bind_response)

        message = LDAPMessage()
        message.setComponentByPosition(0, message_id)  # messageID
        message.setComponentByPosition(1, protocol_op)  # protocolOp

        return message

    def _create_user_search_entry(self, message_id: int, user: LDAPUser) -> LDAPMessage:
        """Create LDAP user search result entry.

        Args:
            message_id: Message ID to respond to
            user: User to return in result

        Returns:
            Encoded search entry message
        """
        # Build attribute list
        attrs = PartialAttributeList()

        # Add uid attribute
        uid_attr = PartialAttribute()
        uid_attr.setComponentByPosition(0, "uid")  # type
        uid_vals = Vals()
        uid_vals.setComponentByPosition(0, user.username)
        uid_attr.setComponentByPosition(1, uid_vals)  # vals
        attrs.setComponentByPosition(0, uid_attr)

        # Add mail attribute
        mail_attr = PartialAttribute()
        mail_attr.setComponentByPosition(0, "mail")
        mail_vals = Vals()
        mail_vals.setComponentByPosition(0, user.email)
        mail_attr.setComponentByPosition(1, mail_vals)
        attrs.setComponentByPosition(1, mail_attr)

        # Add displayName attribute
        if user.display_name:
            display_attr = PartialAttribute()
            display_attr.setComponentByPosition(0, "displayName")
            display_vals = Vals()
            display_vals.setComponentByPosition(0, user.display_name)
            display_attr.setComponentByPosition(1, display_vals)
            attrs.setComponentByPosition(2, display_attr)

        # Add memberOf attribute (groups)
        if user.groups:
            member_attr = PartialAttribute()
            member_attr.setComponentByPosition(0, "memberOf")
            member_vals = Vals()
            for i, group_dn in enumerate(user.groups):
                member_vals.setComponentByPosition(i, group_dn)
            member_attr.setComponentByPosition(1, member_vals)
            next_pos = 3 if user.display_name else 2
            attrs.setComponentByPosition(next_pos, member_attr)

        # Build search result entry
        entry = SearchResultEntry()
        entry.setComponentByPosition(0, user.dn)  # objectName
        entry.setComponentByPosition(1, attrs)  # attributes

        protocol_op = ProtocolOp()
        protocol_op.setComponentByName("searchResEntry", entry)

        message = LDAPMessage()
        message.setComponentByPosition(0, message_id)  # messageID
        message.setComponentByPosition(1, protocol_op)  # protocolOp

        logger.debug(f"Created user search entry: {user.dn} with {len(attrs)} attributes")
        return message

    def _create_group_search_entry(self, message_id: int, group: LDAPGroup) -> LDAPMessage:
        """Create LDAP group search result entry for POSIX groups.

        Args:
            message_id: Message ID to respond to
            group: Group to return in result

        Returns:
            Encoded search entry message
        """
        # Build attribute list with 'cn' attribute (common name)
        attrs = PartialAttributeList()

        cn_attr = PartialAttribute()
        cn_attr.setComponentByPosition(0, "cn")  # type
        cn_vals = Vals()
        cn_vals.setComponentByPosition(0, group.cn)
        cn_attr.setComponentByPosition(1, cn_vals)  # vals
        attrs.setComponentByPosition(0, cn_attr)

        # Build search result entry
        entry = SearchResultEntry()
        entry.setComponentByPosition(0, group.dn)  # objectName
        entry.setComponentByPosition(1, attrs)  # attributes

        protocol_op = ProtocolOp()
        protocol_op.setComponentByName("searchResEntry", entry)

        message = LDAPMessage()
        message.setComponentByPosition(0, message_id)  # messageID
        message.setComponentByPosition(1, protocol_op)  # protocolOp

        logger.debug(f"Created group search entry: {group.dn} (cn={group.cn})")
        return message

    def _send_search_done(self, message_id: int, result_code: int, matched_count: int) -> None:
        """Send search done response.

        Args:
            message_id: Message ID to respond to
            result_code: LDAP result code (typically 0=success)
            matched_count: Number of entries matched (for logging)
        """
        search_done = SearchResultDone()
        search_done.setComponentByPosition(0, result_code)  # resultCode
        search_done.setComponentByPosition(1, "")  # matchedDN
        search_done.setComponentByPosition(2, "")  # diagnosticMessage

        protocol_op = ProtocolOp()
        protocol_op.setComponentByName("searchResDone", search_done)

        message = LDAPMessage()
        message.setComponentByPosition(0, message_id)  # messageID
        message.setComponentByPosition(1, protocol_op)  # protocolOp

        self.request.sendall(encoder.encode(message))
        logger.info(f"Search done: {matched_count} entries matched")
