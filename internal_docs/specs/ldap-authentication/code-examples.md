# Code Examples

## LDAPConfig Dataclass

```python
from dataclasses import dataclass
from typing import Optional

@dataclass
class LDAPConfig:
    """LDAP server configuration."""
    
    # Server connection
    host: str
    port: int = 389
    tls_mode: Literal["none", "starttls", "ldaps"] = "starttls"
    tls_verify: bool = True
    
    # Advanced TLS (optional, for enterprise)
    tls_ca_cert_file: Optional[str] = None
    tls_client_cert_file: Optional[str] = None
    tls_client_key_file: Optional[str] = None
    
    # Bind credentials (service account)
    bind_dn: Optional[str] = None
    bind_password: Optional[str] = None
    
    # User search
    user_search_base: str
    user_search_filter: str = "(&(objectClass=user)(sAMAccountName=%s))"
    
    # Attribute mapping
    attr_email: str = "mail"
    attr_display_name: str = "displayName"
    attr_member_of: str = "memberOf"
    
    # Group search (for POSIX/OpenLDAP)
    group_search_base: Optional[str] = None
    group_search_filter: Optional[str] = None
    
    # Group to role mappings (Grafana-compatible format)
    # Matches Grafana's GroupToOrgRole struct (minus org_id which Phoenix doesn't support)
    group_role_mappings: list[dict[str, str]]  # [{"group_dn": "...", "role": "..."}]
    
    @classmethod
    def from_env(cls) -> Optional["LDAPConfig"]:
        """Load LDAP config from environment variables.
        
        Raises:
            ValueError: If configuration is invalid
            json.JSONDecodeError: If GROUP_ROLE_MAPPINGS is not valid JSON
        """
        host = os.getenv("PHOENIX_LDAP_HOST")
        if not host:
            return None
        
        # Parse and validate group role mappings (Grafana-compatible format)
        mappings_json = os.getenv("PHOENIX_LDAP_GROUP_ROLE_MAPPINGS", "[]")
        try:
            group_role_mappings = json.loads(mappings_json)
        except json.JSONDecodeError as e:
            raise ValueError(
                f"PHOENIX_LDAP_GROUP_ROLE_MAPPINGS is not valid JSON: {e}. "
                f"Expected format: [{{'group_dn': '...', 'role': 'ADMIN'}}]"
            )
        
        # Validate role mappings structure (Grafana compatibility)
        if not isinstance(group_role_mappings, list):
            raise ValueError(
                "PHOENIX_LDAP_GROUP_ROLE_MAPPINGS must be a JSON array. "
                f"Expected format: [{{'group_dn': '...', 'role': 'ADMIN'}}]"
            )
        
        VALID_ROLES = {"ADMIN", "MEMBER", "VIEWER"}  # Phoenix internal role names
        for idx, mapping in enumerate(group_role_mappings):
            if not isinstance(mapping, dict):
                raise ValueError(
                    f"PHOENIX_LDAP_GROUP_ROLE_MAPPINGS[{idx}] must be an object. "
                    f"Got: {type(mapping).__name__}"
                )
            if "group_dn" not in mapping:
                raise ValueError(
                    f"PHOENIX_LDAP_GROUP_ROLE_MAPPINGS[{idx}] missing required field 'group_dn'"
                )
            if "role" not in mapping:
                raise ValueError(
                    f"PHOENIX_LDAP_GROUP_ROLE_MAPPINGS[{idx}] missing required field 'role'"
                )
            if mapping["role"] not in VALID_ROLES:
                raise ValueError(
                    f"PHOENIX_LDAP_GROUP_ROLE_MAPPINGS[{idx}]: role must be one of {VALID_ROLES}. "
                    f"Got: '{mapping['role']}' (note: case-sensitive, use uppercase)"
                )
        
        # Validate TLS mode
        tls_mode = os.getenv("PHOENIX_LDAP_TLS_MODE", "starttls")
        if tls_mode not in ("starttls", "ldaps"):
            raise ValueError(
                f"PHOENIX_LDAP_TLS_MODE must be 'starttls' or 'ldaps'. Got: '{tls_mode}'"
            )
        
        # Validate group search configuration
        attr_member_of = os.getenv("PHOENIX_LDAP_ATTR_MEMBER_OF", "memberOf")
        group_search_base_dns_json = os.getenv("PHOENIX_LDAP_GROUP_SEARCH_BASE_DNS", "")
        group_search_filter = os.getenv("PHOENIX_LDAP_GROUP_SEARCH_FILTER")
        
        group_search_base_dns = json.loads(group_search_base_dns_json) if group_search_base_dns_json else []
        
        # If group_search_filter is set, base_dns is required
        if group_search_filter and not group_search_base_dns:
            raise ValueError(
                "PHOENIX_LDAP_GROUP_SEARCH_FILTER is set but "
                "PHOENIX_LDAP_GROUP_SEARCH_BASE_DNS is missing. "
                "Both are required for POSIX group search."
            )
        
        # Security warnings (log, don't fail)
        tls_mode = os.getenv("PHOENIX_LDAP_TLS_MODE", "starttls").lower()
        tls_verify = os.getenv("PHOENIX_LDAP_TLS_VERIFY", "true").lower() == "true"
        if tls_mode == "none":
            logger.warning(
                "PHOENIX_LDAP_TLS_MODE=none - credentials will be sent in plaintext! "
                "This is insecure for production."
            )
        if tls_mode != "none" and not tls_verify:
            logger.warning(
                "PHOENIX_LDAP_TLS_VERIFY is false - certificates will not be validated! "
                "This is insecure for production (vulnerable to MITM attacks)."
            )
        
        # Parse user search base DNs (JSON array)
        user_search_base_dns_json = os.getenv("PHOENIX_LDAP_USER_SEARCH_BASE_DNS", "")
        user_search_base_dns = json.loads(user_search_base_dns_json) if user_search_base_dns_json else []
        
        return cls(
            host=host,
            port=int(os.getenv("PHOENIX_LDAP_PORT", "389")),
            tls_mode=tls_mode,
            tls_verify=tls_verify,
            bind_dn=os.getenv("PHOENIX_LDAP_BIND_DN"),
            bind_password=os.getenv("PHOENIX_LDAP_BIND_PASSWORD"),
            user_search_base_dns=tuple(user_search_base_dns),
            user_search_filter=os.getenv(
                "PHOENIX_LDAP_USER_SEARCH_FILTER",
                "(&(objectClass=user)(sAMAccountName=%s))"
            ),
            attr_email=os.getenv("PHOENIX_LDAP_ATTR_EMAIL", "mail"),
            attr_display_name=os.getenv("PHOENIX_LDAP_ATTR_DISPLAY_NAME", "displayName"),
            attr_member_of=attr_member_of,
            group_search_base_dns=tuple(group_search_base_dns),
            group_search_filter=group_search_filter,
            group_role_mappings=group_role_mappings,
        )
```

## LDAPAuthenticator Class (Skeleton)

```python
from ldap3 import Server, Connection, Tls, SUBTREE
from ldap3.core.exceptions import LDAPException
from ldap3.utils.conv import escape_filter_chars
import ssl

class LDAPAuthenticator:
    """Handles LDAP authentication and user attribute retrieval."""
    
    def __init__(self, config: LDAPConfig):
        self.config = config
        self.servers = self._create_servers()
    
    def _create_servers(self) -> list[Server]:
        """Create ldap3 Server objects for all configured hosts."""
        hosts = [h.strip() for h in self.config.host.split(",")]
        
        tls_config = None
        if self.config.tls_mode != "none":
            tls_config = Tls(
                validate=ssl.CERT_REQUIRED if self.config.tls_verify else ssl.CERT_NONE
            )
        
        servers = []
        for host in hosts:
            server = Server(
                host,
                port=self.config.port,
                use_ssl=(self.config.tls_mode == "ldaps"),
                tls=tls_config,
                connect_timeout=10,  # 10 second timeout - sufficient for most networks
            )
            servers.append(server)
        
        return servers
    
    async def authenticate(
        self, username: str, password: str
    ) -> Optional[dict[str, Any]]:
        """
        Authenticate user against LDAP and return user info.
        
        Returns:
            dict with keys: email, display_name, groups, user_dn
            or None if authentication fails
        """
        # 1. Connect to LDAP server
        # 2. Bind with service account (if configured)
        # 3. Search for user by username
        # 4. Authenticate user (bind with user's credentials)
        # 5. Retrieve user attributes
        # 6. Query user's groups
        # 7. Return user info
        
        # Implementation details in full code...
        pass
    
    def map_groups_to_role(self, group_dns: list[str]) -> str:
        """Map LDAP group DNs to Phoenix role.
        
        Config format: {"group_dn": "...", "role": "ADMIN|MEMBER|VIEWER"}
        Uses Phoenix roles directly - no intermediary mapping needed.
        """
        # Iterate through mappings in priority order (first match wins)
        for mapping in self.config.group_role_mappings:
            group_dn = mapping["group_dn"]
            role = mapping["role"]  # Direct Phoenix role name
            
            # Check for wildcard match (matches all users)
            if group_dn == "*":
                return role
            
            # Check if user is in this specific group (case-insensitive)
            if self._is_member_of(group_dns, group_dn):
                return role
        
        # No matching groups - deny access
        return None
    
    def _is_member_of(self, user_groups: list[str], target_group: str) -> bool:
        """Check if user is member of LDAP group.
        
        Logic verified against Grafana's implementation:
        https://github.com/grafana/grafana/blob/main/pkg/services/ldap/helpers.go
        
        - Wildcard "*" matches all users
        - Case-insensitive DN comparison (strings.EqualFold)
        - Simple string match, no DN normalization
        """
        # Wildcard matches everyone
        if target_group == "*":
            return True
        
        # Case-insensitive string comparison
        for group in user_groups:
            if group.lower() == target_group.lower():
                return True
        
        return False
```

## API Endpoint

```python
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

router = APIRouter(prefix="/auth/ldap", tags=["auth"])

class LDAPLoginRequest(BaseModel):
    username: str
    password: str

@router.post("/login")
async def ldap_login(
    request: LDAPLoginRequest,
    session: AsyncSession = Depends(get_session),
) -> LoginResponse:
    """Authenticate user via LDAP."""
    
    # Get LDAP config
    ldap_config = get_env_auth_settings().ldap_config
    if not ldap_config:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LDAP authentication not configured",
        )
    
    # Authenticate with LDAP
    authenticator = LDAPAuthenticator(ldap_config)
    try:
        user_info = await authenticator.authenticate(
            request.username,
            request.password
        )
    except LDAPException as e:
        logger.error(f"LDAP authentication failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service unavailable",
        )
    
    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    
    # Map groups to role
    role_name = authenticator.map_groups_to_role(user_info["groups"])
    if not role_name:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    
    # Create or update user in database
    user = await _process_ldap_user(
        session=session,
        ldap_username=request.username,
        user_info=user_info,
        role_name=role_name,
    )
    
    # Issue JWT tokens
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    
    return LoginResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )
```

**Note**: For complete, production-ready implementations, see:
- `src/phoenix/config.py` - LDAPConfig with full validation
- `src/phoenix/server/ldap.py` - LDAPAuthenticator with all features
- `src/phoenix/server/api/routers/auth.py` - LDAP login endpoint

