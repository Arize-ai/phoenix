# Configuration Reference

**⚠️ CRITICAL: These environment variable names are ONE-WAY door decisions. Once released, changing them breaks user configurations.**

## Environment Variable Contract Summary

| Variable | Required? | Default | Type | Notes |
|----------|-----------|---------|------|-------|
| `PHOENIX_LDAP_HOST` | ✅ **Required** | - | string | Comma-separated for failover |
| `PHOENIX_LDAP_PORT` | Optional | `389` (starttls) or `636` (ldaps) | int | Defaults based on `tls_mode` |
| `PHOENIX_LDAP_TLS_MODE` | Optional | `starttls` | `none\|starttls\|ldaps` | TLS connection mode |
| `PHOENIX_LDAP_TLS_VERIFY` | Optional | `true` | boolean | **Always true in production** |
| `PHOENIX_LDAP_TLS_CA_CERT_FILE` | Optional | - | path | Custom CA certificate (PEM) for private CAs |
| `PHOENIX_LDAP_TLS_CLIENT_CERT_FILE` | Optional | - | path | Client certificate (PEM) for mutual TLS |
| `PHOENIX_LDAP_TLS_CLIENT_KEY_FILE` | Optional | - | path | Client private key (PEM) for mutual TLS |
| `PHOENIX_LDAP_BIND_DN` | Optional | - | string | Service account (required for search-and-bind) |
| `PHOENIX_LDAP_BIND_PASSWORD` | Optional | - | string | Service account password |
| `PHOENIX_LDAP_USER_SEARCH_BASE_DNS` | ✅ **Required** | - | JSON array | `'["ou=users,dc=example,dc=com"]'` |
| `PHOENIX_LDAP_USER_SEARCH_FILTER` | Optional | `(&(objectClass=user)(sAMAccountName=%s))` | string | `%s` = username placeholder |
| `PHOENIX_LDAP_ATTR_EMAIL` | Optional | `mail` | string | Email attribute name |
| `PHOENIX_LDAP_ATTR_DISPLAY_NAME` | Optional | `displayName` | string | Display name attribute |
| `PHOENIX_LDAP_ATTR_MEMBER_OF` | Optional | `memberOf` | string | Group membership attribute (used when `GROUP_SEARCH_FILTER` not set) |
| `PHOENIX_LDAP_GROUP_SEARCH_BASE_DNS` | Conditional | - | JSON array | Required when `GROUP_SEARCH_FILTER` is set |
| `PHOENIX_LDAP_GROUP_SEARCH_FILTER` | Optional | - | string | When set, enables POSIX mode (ignores `ATTR_MEMBER_OF`) |
| `PHOENIX_LDAP_GROUP_SEARCH_FILTER_USER_ATTR` | Optional | - | string | Attribute to substitute in GROUP_SEARCH_FILTER (default: login username) |
| `PHOENIX_LDAP_GROUP_ROLE_MAPPINGS` | ✅ **Required** | `[]` | JSON array | **Grafana-compatible format** |
| `PHOENIX_LDAP_ALLOW_SIGN_UP` | Optional | `true` | boolean | Auto-create users on first login |
| `PHOENIX_LDAP_ATTR_UNIQUE_ID` | Optional | - | string | Immutable ID (only if expecting email changes) |

### TLS Mode Default

- Phoenix defaults `PHOENIX_LDAP_TLS_MODE` to `starttls` so deployments can connect over the commonly open port 389 while still upgrading to TLS before any bind.
- This matches what most Active Directory/OpenLDAP environments expect out of the box and avoids asking operators to expose port 636 unless they explicitly choose LDAPS.
- The implementation always calls `start_tls()` before `bind()` (see [Protocol Compliance](./protocol-compliance.md#7-starttls-implementation--security)), and the docker MITM profile continuously verifies that StartTLS traffic stays encrypted, so the default remains a secure channel rather than plaintext.
- Admins who prefer TLS-from-byte-zero can set `PHOENIX_LDAP_TLS_MODE=ldaps`, which automatically defaults the port to 636 in `LDAPConfig.from_env`.

**Key Design Decisions** (verified against Grafana source code):
- ✅ **Prefix**: `PHOENIX_LDAP_*` matches Phoenix conventions, no conflict with Grafana
- ✅ **Boolean values**: String `"true"`/`"false"` (not `1`/`0`) for clarity
- ✅ **JSON format**: `GROUP_ROLE_MAPPINGS` uses Grafana's `GroupToOrgRole` structure
- ✅ **Defaults**: Match Grafana defaults where applicable (timeout: 10s, port: 389, etc.)
- ⚠️ **Limitation**: Replica-only multi-server (all servers must share config)

## Phoenix vs. Grafana Configuration Comparison

This table maps Phoenix's environment variables to Grafana's TOML configuration file structure, helping users migrate between systems.

| **Configuration** | **Phoenix (Environment Variables)** | **Grafana (ldap.toml)** | **Notes** |
|-------------------|-------------------------------------|-------------------------|-----------|
| **Enable LDAP** | `PHOENIX_LDAP_HOST` (presence) | `[auth.ldap]`<br>`enabled = true`<br>`config_file = "/etc/grafana/ldap.toml"` | Phoenix: Auto-enabled when HOST is set<br>Grafana: Requires explicit enable + file path |
| **Server Host** | `PHOENIX_LDAP_HOST="dc1.com,dc2.com"` | `[[servers]]`<br>`host = "dc1.com"`<br>`[[servers]]`<br>`host = "dc2.com"` | Phoenix: Comma-separated string<br>Grafana: Multiple `[[servers]]` blocks |
| **Server Port** | `PHOENIX_LDAP_PORT=389` | `port = 389` | Both default to 389 |
| **TLS Mode** | `PHOENIX_LDAP_TLS_MODE="starttls"` | `use_ssl = false`<br>`start_tls = false` (default) | Phoenix: Single TLS_MODE with StartTLS default<br>Grafana: Separate SSL/StartTLS flags; StartTLS disabled until explicitly enabled |
| **TLS Verification** | `PHOENIX_LDAP_TLS_VERIFY="true"` | `ssl_skip_verify = false` | Both verify certificates by default |
| **Custom CA Cert** | `PHOENIX_LDAP_TLS_CA_CERT_FILE="/path/to/ca.pem"` | `root_ca_cert = "/path/to/ca.pem"` | Identical semantics for private CAs |
| **Client Cert (mTLS)** | `PHOENIX_LDAP_TLS_CLIENT_CERT_FILE="/path/to/client.crt"`<br>`PHOENIX_LDAP_TLS_CLIENT_KEY_FILE="/path/to/client.key"` | `client_cert = "/path/to/client.crt"`<br>`client_key = "/path/to/client.key"` | Identical semantics for mutual TLS |
| **Bind DN** | `PHOENIX_LDAP_BIND_DN="cn=admin,..."` | `bind_dn = "cn=admin,..."` | Identical semantics |
| **Bind Password** | `PHOENIX_LDAP_BIND_PASSWORD="secret"` | `bind_password = "secret"`<br>or `bind_password = '${ENV_VAR}'` | Phoenix: Direct env var<br>Grafana: TOML value or interpolation |
| **User Search Base** | `PHOENIX_LDAP_USER_SEARCH_BASE_DNS='["ou=users,..."]'` | `search_base_dns = ["ou=users,dc=..."]` | Both: JSON/TOML array of DNs |
| **User Search Filter** | `PHOENIX_LDAP_USER_SEARCH_FILTER="(uid=%s)"` | `search_filter = "(uid=%s)"` | Identical: `%s` = username |
| **Email Attribute** | `PHOENIX_LDAP_ATTR_EMAIL="mail"` | `[servers.attributes]`<br>`email = "mail"` | Phoenix: Direct env var<br>Grafana: Nested TOML section |
| **Name Attribute** | `PHOENIX_LDAP_ATTR_DISPLAY_NAME="displayName"` | `name = "displayName"` | Both map display name |
| **Unique ID** | `PHOENIX_LDAP_ATTR_UNIQUE_ID="objectGUID"` | Not supported | Phoenix: Optional immutable identifier for email change resilience |
| **Group Membership** | `PHOENIX_LDAP_ATTR_MEMBER_OF="memberOf"` | `member_of = "memberOf"` | Active Directory attribute |
| **Group Search Base** | `PHOENIX_LDAP_GROUP_SEARCH_BASE_DNS='["ou=groups,..."]'` | `group_search_base_dns = ["ou=groups,dc=..."]` | Both: JSON/TOML array of DNs |
| **Group Search Filter** | `PHOENIX_LDAP_GROUP_SEARCH_FILTER="(member=%s)"` | `group_search_filter = "(member=%s)"` | Identical: `%s` = substituted value |
| **Group Filter User Attr** | `PHOENIX_LDAP_GROUP_SEARCH_FILTER_USER_ATTR="uid"` | `group_search_filter_user_attribute = "uid"` | Attribute value to substitute for `%s` in GROUP_SEARCH_FILTER. When not set, uses login username. |
| **Group→Role Mapping** | `PHOENIX_LDAP_GROUP_ROLE_MAPPINGS='[`<br>`  {"group_dn": "cn=admins,...", "role": "ADMIN"}`<br>`]'` | `[[servers.group_mappings]]`<br>`group_dn = "cn=admins,..."`<br>`org_role = "Admin"` | Phoenix: JSON with `role` (no org)<br>Grafana: TOML with `org_role` |
| **Allow Sign-Up** | `PHOENIX_LDAP_ALLOW_SIGN_UP="true"` | `[auth.ldap]`<br>`allow_sign_up = true` | Both default to `true` |
| **Timeout** | Not exposed (uses ldap3 defaults) | `timeout = 10` | Grafana: Configurable in seconds |
| **Connection Pooling** | Not exposed (uses ldap3 defaults) | Not configurable | Both use underlying library defaults |

**Key Differences**:

1. **Configuration Method**
   - Phoenix: Pure environment variables (12-factor app pattern)
   - Grafana: TOML configuration file with optional env var interpolation

2. **Multi-Server Configuration**
   - Phoenix: Comma-separated replicas (identical config only)
   - Grafana: Multiple `[[servers]]` blocks (can have different configs per server)

3. **Role Mapping Format**
   - Phoenix: JSON with `role` field, uppercase values (`ADMIN`, `MEMBER`, `VIEWER`)
   - Grafana: TOML with `org_role` field, capitalized values (`Admin`, `Editor`, `Viewer`)

4. **Migration Path**
   - Grafana → Phoenix: Must convert TOML to env vars manually
   - Cannot reuse `ldap.toml` files directly
   - Role mapping requires case conversion (`Admin` → `ADMIN`, etc.)

**Compatibility Notes**:
- **Grafana users**: Cannot directly reuse `ldap.toml` files (must convert to env vars)
- **Field names**: Grafana uses `org_role`, Phoenix uses `role` (no org concept)
- **Role values**: Grafana uses capitalized (`Admin`, `Editor`, `Viewer`), Phoenix uses uppercase (`ADMIN`, `MEMBER`, `VIEWER`)

**Common Configuration Mistakes to Avoid**:

| ❌ **WRONG** | ✅ **CORRECT** | Reason |
|-------------|---------------|---------|
| `PHOENIX_LDAP_GROUP_ROLE_MAPPINGS='{"admin":["..."]}'` | `PHOENIX_LDAP_GROUP_ROLE_MAPPINGS='[{"group_dn":"...", "role":"ADMIN"}]'` | Must use JSON array structure with required fields |
| `"role": "admin"` (lowercase) | `"role": "ADMIN"` (uppercase) | Phoenix uses uppercase role names |
| `"role": "ADMIN"` (Grafana field) | `"role": "ADMIN"` (Phoenix field) | Phoenix uses `role`, not `org_role` (no org concept) |
| `PHOENIX_LDAP_TLS_MODE=starttls` (unquoted) | `PHOENIX_LDAP_TLS_MODE="starttls"` (quoted) | Shell may require quotes for strings |
| `PHOENIX_LDAP_PORT="389"` (string) | `PHOENIX_LDAP_PORT=389` (int) | Port should be unquoted integer |
| Multiple `PHOENIX_LDAP_HOST` lines | `PHOENIX_LDAP_HOST="dc1.com,dc2.com"` | Use comma-separated, not multiple vars |
| `%s` in `GROUP_SEARCH_FILTER` for username | `%s` in `USER_SEARCH_FILTER` | User filter uses username; group filter uses login username by default (or attribute from GROUP_SEARCH_FILTER_USER_ATTR) |

**Validation Checklist** (implemented in code):
1. ✅ `PHOENIX_LDAP_HOST` is not empty (config.py:1423)
2. ✅ `PHOENIX_LDAP_GROUP_ROLE_MAPPINGS` is valid JSON array (config.py:1433-1442)
3. ✅ Each mapping has `group_dn` and `role` fields (config.py:1457-1476)
4. ✅ `role` values are `"ADMIN"`, `"MEMBER"`, or `"VIEWER"` (case-insensitive) (config.py:1449)
5. ✅ If `GROUP_SEARCH_FILTER` is set, `GROUP_SEARCH_BASE_DNS` must also be set
6. ✅ `TLS_MODE` is either `"starttls"` or `"ldaps"` (config.py:1484-1488)
7. ⚠️ **Security**: Warn if `TLS_MODE=none` or `TLS_VERIFY=false` in production (config.py)

---

## Complete Environment Variables

```bash
# ==============================================================================
# LDAP Server Connection
# ==============================================================================

# LDAP server hosts (comma-separated for multiple servers)
# Examples:
#   - "ldap.example.com"
#   - "dc1.corp.com,dc2.corp.com,dc3.corp.com"
PHOENIX_LDAP_HOST="ldap.corp.example.com"

# LDAP server port (default: 389 for StartTLS, 636 for LDAPS)
PHOENIX_LDAP_PORT=389

# Use TLS (recommended: always true for production)
# Options: "none", "starttls", "ldaps"
PHOENIX_LDAP_TLS_MODE="starttls"

# TLS mode: "starttls" or "ldaps"
# - starttls: Start with plaintext, upgrade to TLS (port 389)
# - ldaps: TLS from the start (port 636)
PHOENIX_LDAP_TLS_MODE="starttls"

# Verify TLS certificates (recommended: always true for production)
# Options: "true" or "false"
PHOENIX_LDAP_TLS_VERIFY="true"

# ==============================================================================
# Bind Configuration (Service Account)
# ==============================================================================

# Service account DN for binding (optional for direct bind)
# Examples:
#   - Active Directory: "CN=svc-phoenix,OU=Service Accounts,DC=corp,DC=com"
#   - OpenLDAP: "cn=readonly,dc=example,dc=com"
PHOENIX_LDAP_BIND_DN="CN=svc-phoenix,OU=Service Accounts,DC=corp,DC=com"

# Service account password
PHOENIX_LDAP_BIND_PASSWORD="service-account-password-here"

# ==============================================================================
# User Search Configuration
# ==============================================================================

# JSON array of base DNs for user searches (searched in order until user found)
# Examples:
#   - '["OU=Users,DC=corp,DC=com"]'
#   - '["OU=Employees,DC=corp,DC=com", "OU=Contractors,DC=corp,DC=com"]'
PHOENIX_LDAP_USER_SEARCH_BASE_DNS='["OU=Users,DC=corp,DC=com"]'

# User search filter (use %s as placeholder for username)
# Examples:
#   - Active Directory: "(&(objectClass=user)(sAMAccountName=%s))"
#   - OpenLDAP: "(&(objectClass=inetOrgPerson)(uid=%s))"
PHOENIX_LDAP_USER_SEARCH_FILTER="(&(objectClass=user)(sAMAccountName=%s))"

# ==============================================================================
# Attribute Mapping
# ==============================================================================

# LDAP attribute containing user's email
# Examples: "mail", "userPrincipalName", "email"
PHOENIX_LDAP_ATTR_EMAIL="mail"

# LDAP attribute containing user's display name
# Examples: "displayName", "cn", "name"
PHOENIX_LDAP_ATTR_DISPLAY_NAME="displayName"

# LDAP attribute containing group memberships (for Active Directory)
# Examples: "memberOf" (Active Directory), "" (use group search for POSIX)
PHOENIX_LDAP_ATTR_MEMBER_OF="memberOf"

# ==============================================================================
# User Identification (Optional)
# ==============================================================================

# Immutable unique ID attribute (only configure if you expect email changes)
# Use cases: company rebranding, M&A, frequent name changes, compliance requirements
# - Active Directory: "objectGUID"
# - OpenLDAP: "entryUUID"
# - 389 Directory Server: "nsUniqueId"
# When not set (default), email is used as the identifier.
# PHOENIX_LDAP_ATTR_UNIQUE_ID="objectGUID"

# ==============================================================================
# Group Search (for POSIX/OpenLDAP without memberOf)
# ==============================================================================

# JSON array of base DNs for group searches (groups collected from all bases)
# Examples:
#   - '["OU=Groups,DC=corp,DC=com"]'
#   - '["OU=Groups,DC=corp,DC=com", "OU=Teams,DC=corp,DC=com"]'
PHOENIX_LDAP_GROUP_SEARCH_BASE_DNS='["OU=Groups,DC=corp,DC=com"]'

# Group search filter (use %s as placeholder for substituted value)
# Example: "(&(objectClass=group)(member=%s))"
PHOENIX_LDAP_GROUP_SEARCH_FILTER="(&(objectClass=group)(member=%s))"

# Attribute from user entry to substitute for %s in GROUP_SEARCH_FILTER
# When set: Reads the specified attribute from the user's LDAP entry
# When not set (default): Uses the login username directly
#
# Common values:
#   - "uid": For POSIX groups using memberUid (contains uid attribute value)
#   - "dn" or "distinguishedName": For groups using member with full DNs (AD)
#   - Not set: Uses login username (works for most POSIX setups)
#
# Example POSIX (memberUid contains usernames):
#   PHOENIX_LDAP_GROUP_SEARCH_FILTER="(&(objectClass=posixGroup)(memberUid=%s))"
#   # GROUP_SEARCH_FILTER_USER_ATTR not set - uses login username
#
# Example AD (member contains full DNs):
#   PHOENIX_LDAP_GROUP_SEARCH_FILTER="(member:1.2.840.113556.1.4.1941:=%s)"
#   PHOENIX_LDAP_GROUP_SEARCH_FILTER_USER_ATTR="dn"
# PHOENIX_LDAP_GROUP_SEARCH_FILTER_USER_ATTR="uid"

# ==============================================================================
# Group to Role Mappings (Grafana-Compatible Format)
# ==============================================================================

# Grafana-compatible format (verified against Grafana source code)
# Based on: https://github.com/grafana/grafana/blob/main/pkg/services/ldap/settings.go
#
# Grafana's GroupToOrgRole struct (for reference):
#   type GroupToOrgRole struct {
#       GroupDN        string       `json:"group_dn"`         // REQUIRED
#       OrgRole        RoleType     `json:"org_role"`         // REQUIRED
#       OrgId          int64        `json:"org_id"`           // Optional (defaults to 1)
#       IsGrafanaAdmin *bool        `json:"grafana_admin"`    // Optional
#   }
#
# Phoenix JSON Schema (TypeScript notation):
#   Array<{
#     group_dn: string;      // REQUIRED: LDAP group DN or "*" for wildcard
#     role: "ADMIN" | "MEMBER" | "VIEWER";  // REQUIRED: Capitalized!
#   }>
#
# Phoenix Role Mapping (Direct - No Intermediary):
#   - "ADMIN"  → ADMIN role (Phoenix)
#   - "MEMBER" → MEMBER role (Phoenix)
#   - "VIEWER" → VIEWER role (Phoenix)
#
# Note: Phoenix uses its internal role names directly in the configuration.
# This differs from the original Grafana-compatible approach which used
# Grafana role names ("Admin", "Editor", "Viewer") as an intermediary.
#
# Matching Logic (verified against Grafana helpers.go):
#   - Wildcard "*" matches ALL users (checked first)
#   - DN matching is case-insensitive (strings.EqualFold)
#   - First match wins (priority order matters!)
#
PHOENIX_LDAP_GROUP_ROLE_MAPPINGS='[
  {"group_dn": "CN=Phoenix Admins,OU=Groups,DC=corp,DC=com", "role": "ADMIN"},
  {"group_dn": "CN=Phoenix Users,OU=Groups,DC=corp,DC=com", "role": "MEMBER"},
  {"group_dn": "CN=Engineering,OU=Groups,DC=corp,DC=com", "role": "MEMBER"},
  {"group_dn": "CN=Phoenix Viewers,OU=Groups,DC=corp,DC=com", "role": "VIEWER"},
  {"group_dn": "*", "role": "VIEWER"}
]'

# ==============================================================================
# Sign-Up Control (Grafana-Compatible)
# ==============================================================================

# Allow automatic user creation on first LDAP login
# Options: "true" (default, matches Grafana) or "false"
# - "true": Any valid LDAP user can create an account on first login
# - "false": Users must be pre-provisioned before first login:
#     * Via PHOENIX_ADMINS env var at startup
#     * Via the application's user management UI
#   Pre-provisioned users are matched by email on first LDAP login.
# Security: Set to "false" in environments requiring pre-approved access
PHOENIX_LDAP_ALLOW_SIGN_UP="true"

```

## Configuration Examples

**Example 1: Active Directory (Single Server)**
```bash
PHOENIX_LDAP_HOST="ad.corp.com"
PHOENIX_LDAP_PORT=389
PHOENIX_LDAP_TLS_MODE="starttls"
PHOENIX_LDAP_BIND_DN="CN=svc-phoenix,OU=Service Accounts,DC=corp,DC=com"
PHOENIX_LDAP_BIND_PASSWORD="password"
PHOENIX_LDAP_USER_SEARCH_BASE_DNS='["OU=Users,DC=corp,DC=com"]'
PHOENIX_LDAP_USER_SEARCH_FILTER="(&(objectClass=user)(sAMAccountName=%s))"
PHOENIX_LDAP_ATTR_EMAIL="mail"
PHOENIX_LDAP_ATTR_DISPLAY_NAME="displayName"
PHOENIX_LDAP_ATTR_MEMBER_OF="memberOf"
# Optional: Only set if you expect user emails to change (rebranding, M&A)
# PHOENIX_LDAP_ATTR_UNIQUE_ID="objectGUID"
PHOENIX_LDAP_GROUP_ROLE_MAPPINGS='[
  {"group_dn": "CN=Phoenix Admins,OU=Groups,DC=corp,DC=com", "role": "ADMIN"},
  {"group_dn": "CN=Phoenix Users,OU=Groups,DC=corp,DC=com", "role": "MEMBER"}
]'
```

**Example 2: OpenLDAP (POSIX Groups)**
```bash
PHOENIX_LDAP_HOST="ldap.example.com"
PHOENIX_LDAP_PORT=389
PHOENIX_LDAP_TLS_MODE="starttls"
PHOENIX_LDAP_BIND_DN="cn=readonly,dc=example,dc=com"
PHOENIX_LDAP_BIND_PASSWORD="password"
PHOENIX_LDAP_USER_SEARCH_BASE_DNS='["ou=people,dc=example,dc=com"]'
PHOENIX_LDAP_USER_SEARCH_FILTER="(&(objectClass=inetOrgPerson)(uid=%s))"
PHOENIX_LDAP_ATTR_EMAIL="mail"
PHOENIX_LDAP_ATTR_DISPLAY_NAME="cn"
# Note: When GROUP_SEARCH_FILTER is set, POSIX mode is enabled automatically
# Optional: Only set if you expect user emails to change
# PHOENIX_LDAP_ATTR_UNIQUE_ID="entryUUID"
PHOENIX_LDAP_GROUP_SEARCH_BASE_DNS='["ou=groups,dc=example,dc=com"]'
PHOENIX_LDAP_GROUP_SEARCH_FILTER="(&(objectClass=posixGroup)(memberUid=%s))"
PHOENIX_LDAP_GROUP_ROLE_MAPPINGS='[
  {"group_dn": "cn=phoenix-admins,ou=groups,dc=example,dc=com", "role": "ADMIN"},
  {"group_dn": "*", "role": "VIEWER"}
]'
```

**Example 3: Multiple LDAP Servers (High Availability)**
```bash
PHOENIX_LDAP_HOST="dc1.corp.com,dc2.corp.com,dc3.corp.com"
PHOENIX_LDAP_PORT=389
PHOENIX_LDAP_TLS_MODE="starttls"
# ... rest of configuration same as Example 1
```

