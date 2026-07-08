# Grafana Source Code Research

**Complete Grafana Source Code Analysis** - Detailed findings from reviewing Grafana's LDAP implementation to ensure Phoenix compatibility.

## Files Reviewed

1. [settings.go](https://raw.githubusercontent.com/grafana/grafana/84a07be6e4e1acd8f064c3b390c30188d5703afc/pkg/services/ldap/settings.go) - Struct definitions, defaults
2. [ldap.toml](https://raw.githubusercontent.com/grafana/grafana/84a07be6e4e1acd8f064c3b390c30188d5703afc/conf/ldap.toml) - Example config
3. [service/ldap.go](https://raw.githubusercontent.com/grafana/grafana/84a07be6e4e1acd8f064c3b390c30188d5703afc/pkg/services/ldap/service/ldap.go) - Validation, defaults
4. [ldap.go](https://raw.githubusercontent.com/grafana/grafana/84a07be6e4e1acd8f064c3b390c30188d5703afc/pkg/services/ldap/ldap.go) - Group matching logic
5. [helpers.go](https://raw.githubusercontent.com/grafana/grafana/84a07be6e4e1acd8f064c3b390c30188d5703afc/pkg/services/ldap/helpers.go) - `IsMemberOf()` function
6. [multildap.go](https://raw.githubusercontent.com/grafana/grafana/84a07be6e4e1acd8f064c3b390c30188d5703afc/pkg/services/ldap/multildap/multildap.go) - Multi-server failover

## Grafana's GroupToOrgRole Struct

```go
type GroupToOrgRole struct {
    GroupDN        string   `json:"group_dn"`
    OrgId          int64    `json:"org_id"`          // Defaults to 1
    IsGrafanaAdmin *bool    `json:"grafana_admin"`   // Optional, for server admin
    OrgRole        RoleType `json:"org_role"`        // "Admin", "Editor", "Viewer"
}
```

## Grafana's Group Matching Logic

```go
func IsMemberOf(memberOf []string, group string) bool {
    if group == "*" {
        return true  // Wildcard matches ALL users
    }
    for _, member := range memberOf {
        if strings.EqualFold(member, group) {  // Case-insensitive!
            return true
        }
    }
    return false
}
```

## Phoenix Adaptation

Phoenix adapts Grafana's configuration format while accounting for Phoenix-specific differences:

**Similarities**:
- ✅ Wildcard `"*"` support - MATCHES GRAFANA (checked first, matches all users)
- ✅ **Case-insensitive DN matching** - MATCHES GRAFANA (`strings.EqualFold`)
- ✅ First-match-wins priority - MATCHES GRAFANA
- ✅ Multi-server failover (tries in order) - MATCHES GRAFANA

**Phoenix-Specific Differences**:
- ✅ Field name: `role` (not `org_role`) - Phoenix has no organizations
- ✅ Values: `"ADMIN"`, `"MEMBER"`, `"VIEWER"` (uppercase) - Matches Phoenix role names
- ⚠️ Omit `org_id` - Phoenix doesn't have multi-org support
- ⚠️ Omit `grafana_admin` - Phoenix doesn't have server admin concept
- ⚠️ Omit team sync (`TeamOrgGroupDTO`) - Phoenix doesn't have teams, only roles

## Configuration Field Comparison

Complete field-by-field comparison between Grafana's `ServerConfig` struct and Phoenix's environment variables.

### Server Connection

| Grafana (`settings.go`) | Phoenix | Status |
|------------------------|---------|--------|
| `Host string` | `PHOENIX_LDAP_HOST` | ✅ Match |
| `Port int` (default 389) | `PHOENIX_LDAP_PORT` (default 389/636 based on mode) | ✅ Match |

### TLS Configuration

| Grafana | Phoenix | Status |
|---------|---------|--------|
| `UseSSL bool` | Combined: `PHOENIX_LDAP_TLS_MODE=ldaps` | ✅ Equivalent |
| `StartTLS bool` | Combined: `PHOENIX_LDAP_TLS_MODE=starttls` | ✅ Equivalent |
| `SkipVerifySSL bool` | `PHOENIX_LDAP_TLS_VERIFY` (inverted logic) | ✅ Equivalent |
| `MinTLSVersion string` | ❌ Not implemented | ⚠️ Low priority |
| `TLSCiphers []string` | ❌ Not implemented | ⚠️ Low priority |
| `RootCACert string` | `PHOENIX_LDAP_TLS_CA_CERT_FILE` | ✅ Match |
| `ClientCert string` | `PHOENIX_LDAP_TLS_CLIENT_CERT_FILE` | ✅ Match |
| `ClientKey string` | `PHOENIX_LDAP_TLS_CLIENT_KEY_FILE` | ✅ Match |

### Bind Configuration

| Grafana | Phoenix | Status |
|---------|---------|--------|
| `BindDN string` | `PHOENIX_LDAP_BIND_DN` | ✅ Match |
| `BindPassword string` | `PHOENIX_LDAP_BIND_PASSWORD` | ✅ Match |
| `Timeout int` (default 10s) | ❌ Not implemented | ⚠️ Low priority |

### User Search

| Grafana | Phoenix | Status |
|---------|---------|--------|
| `SearchBaseDNs []string` | `PHOENIX_LDAP_USER_SEARCH_BASE_DNS` (JSON array) | ✅ **Match** |
| `SearchFilter string` | `PHOENIX_LDAP_USER_SEARCH_FILTER` | ✅ Match |

### Attribute Mapping

| Grafana (`AttributeMap`) | Phoenix | Status |
|--------------------------|---------|--------|
| `Email string` | `PHOENIX_LDAP_ATTR_EMAIL` | ✅ Match |
| `Name string` | `PHOENIX_LDAP_ATTR_DISPLAY_NAME` | ✅ Match |
| `MemberOf string` | `PHOENIX_LDAP_ATTR_MEMBER_OF` | ✅ Match |
| `Username string` | ❌ Not needed (from login form) | ✅ N/A |
| `Surname string` | ❌ Not implemented | ✅ Not needed |
| ❌ Not in Grafana | `PHOENIX_LDAP_ATTR_UNIQUE_ID` | ✅ Phoenix extra |

### Group Search (POSIX)

| Grafana | Phoenix | Status |
|---------|---------|--------|
| `GroupSearchBaseDNs []string` | `PHOENIX_LDAP_GROUP_SEARCH_BASE_DNS` (JSON array) | ✅ **Match** |
| `GroupSearchFilter string` | `PHOENIX_LDAP_GROUP_SEARCH_FILTER` | ✅ Match |
| `GroupSearchFilterUserAttribute string` | `PHOENIX_LDAP_GROUP_SEARCH_FILTER_USER_ATTR` | ✅ **Match** |

#### Group Search Filter User Attribute Behavior

Both Grafana and Phoenix support `group_search_filter_user_attribute` (Grafana) / `GROUP_SEARCH_FILTER_USER_ATTR` (Phoenix) with identical behavior:

**Grafana** (`ldap.go` line 598-605):
```go
if config.GroupSearchFilterUserAttribute == "" {
    filterReplace = getAttribute(config.Attr.Username, entry)
} else {
    filterReplace = getAttribute(
        config.GroupSearchFilterUserAttribute,
        entry,
    )
}
```

**Phoenix** (`ldap.py`):
```python
if self.config.group_search_filter_user_attr:
    filter_value = _get_attribute(user_entry, self.config.group_search_filter_user_attr)
else:
    filter_value = username  # Uses login username
```

**Common values:**
- `"uid"`: For POSIX groups using `memberUid` (contains uid attribute value)
- `"dn"` or `"distinguishedName"`: For groups using `member` with full DNs (Active Directory)
- Not set (default): Uses the login username (works for most POSIX setups)

**Grafana documentation reference:**
- https://grafana.com/docs/grafana/latest/setup-grafana/configure-access/configure-authentication/ldap/

### Group Role Mappings

| Grafana (`GroupToOrgRole`) | Phoenix | Status |
|---------------------------|---------|--------|
| `GroupDN string` | `group_dn` | ✅ Match |
| `OrgRole RoleType` | `role` (not `org_role`) | ✅ Intentional |
| `OrgId int64` | ❌ Not applicable | ✅ N/A (no orgs) |
| `IsGrafanaAdmin *bool` | ❌ Not applicable | ✅ N/A |

### Sign-up Control

| Grafana | Phoenix | Status |
|---------|---------|--------|
| `AllowSignUp bool` | `PHOENIX_LDAP_ALLOW_SIGN_UP` | ✅ Match |

---

### Missing Features (Low Priority)

These Grafana features are not implemented in Phoenix. They can be added later if requested:

| Feature | Grafana | Use Case |
|---------|---------|----------|
| `MinTLSVersion` | Force TLS 1.2+ | Enterprise security compliance |
| `TLSCiphers` | Restrict cipher suites | Enterprise security compliance |
| `Timeout` | Connection timeout (seconds) | Network reliability |

### Phoenix Extras (Not in Grafana)

| Feature | Phoenix | Use Case |
|---------|---------|----------|
| `PHOENIX_LDAP_ATTR_UNIQUE_ID` | Immutable user identifier | Email change resilience (objectGUID, entryUUID) |

---

## Implementation Logic Discrepancies

Detailed comparison of runtime behavior between Grafana and Phoenix LDAP implementations.

### 1. Multi-Server Failover Behavior

Both Grafana and Phoenix support multiple LDAP servers for high availability, but they handle different error conditions differently.

#### Failover Trigger Comparison

| Error Condition | Grafana | Phoenix | Match? |
|----------------|---------|---------|--------|
| **Connection failed** (Dial error) | ✅ Try next server | ✅ Try next server | ✅ Match |
| **User not found** | ✅ Try next server | ❌ Return immediately | ⚠️ **Different** |
| **Invalid password** | ✅ Try next server | ❌ Return immediately | ⚠️ **Different** |
| **Other LDAP errors** | ❌ Return error | ✅ Try next server | ⚠️ **Different** |

#### Grafana's Approach (`multildap.go`)

Grafana defines "silent errors" that trigger failover:

```go
// isSilentError - these errors cause failover to next server
func isSilentError(err error) bool {
    continueErrs := []error{ErrInvalidCredentials, ErrCouldNotFindUser}
    for _, cerr := range continueErrs {
        if errors.Is(err, cerr) {
            return true
        }
    }
    return false
}

// Login - tries all servers
func (multiples *MultiLDAP) Login(query *login.LoginUserQuery) {
    ldapSilentErrors := []error{}
    
    for index, config := range multiples.configs {
        // Dial failure → try next server
        if err := server.Dial(); err != nil {
            if index == len(multiples.configs)-1 {
                return nil, err  // Last server, return error
            }
            continue  // Try next
        }
        
        user, err := server.Login(query)
        if err != nil {
            if isSilentError(err) {  // User not found OR invalid password
                ldapSilentErrors = append(ldapSilentErrors, err)
                continue  // TRY NEXT SERVER
            }
            return nil, err  // Other errors stop immediately
        }
        
        if user != nil {
            return user, nil  // Success!
        }
    }
    
    // After all servers tried:
    // - Return ErrInvalidCredentials if ANY server returned it
    // - Otherwise return ErrCouldNotFindUser
    for _, ldapErr := range ldapSilentErrors {
        if errors.Is(ldapErr, ErrInvalidCredentials) {
            return nil, ErrInvalidCredentials
        }
    }
    return nil, ErrCouldNotFindUser
}
```

**Grafana's use case**: Supports **heterogeneous LDAP servers** where:
- Different servers may have different user populations
- User "alice" might exist only on Server B, not Server A
- Common in organizations with multiple AD domains or forests

#### Phoenix's Approach (`ldap.py`)

Phoenix only fails over on connection errors:

```python
for server in self.servers:
    try:
        with self._establish_connection(server) as conn:
            user_entry = self._search_user(conn, escaped_username)
            if not user_entry:
                # User not found → STOP immediately (no failover)
                self._dummy_bind_for_timing(server, password)
                return None
            
            if not self._verify_user_password(server, user_dn, password):
                # Wrong password → STOP immediately (no failover)
                return None
            
            # Success!
            return LDAPUserInfo(...)
            
    except LDAPException as e:
        # Connection/protocol error → TRY NEXT SERVER
        logger.warning(f"LDAP server {server.host} failed: {type(e).__name__}")
        continue

# All servers failed with LDAPException
return None
```

**Phoenix's use case**: Assumes **replica servers** where:
- All servers are replicas of the same directory
- User sets are identical across all servers
- "User not found" is a definitive answer, not a reason to try elsewhere

#### Design Rationale

**Why Phoenix chose NOT to failover on "user not found":**

1. **Semantic correctness**: In replica-based HA, servers have identical data. If user doesn't exist on Server A, they won't exist on Server B.

2. **Avoid masking issues**: Failing over on "user not found" could hide:
   - Replication lag issues
   - Misconfigured search bases
   - AD Global Catalog vs Domain Controller inconsistencies

3. **Security**: Trying all servers on "invalid password" could:
   - Increase attack surface (more servers to probe)
   - Leak information about which server has the user

4. **Simplicity**: One server answers definitively; no need to aggregate errors.

#### When This Matters

| Scenario | Grafana | Phoenix |
|----------|---------|---------|
| **Replica HA** (identical user sets) | Works (redundant checks) | Works (optimal) |
| **Multi-domain/forest** (different user sets) | Works | ❌ Won't find users on non-primary servers |
| **AD GC vs DC** (partial vs full attributes) | Works | May fail if GC is primary |

#### Known Limitation

**Phoenix does not support heterogeneous LDAP servers** (different user populations on different servers).

| Architecture | Supported? |
|--------------|------------|
| Replica HA (identical servers) | ✅ Fully supported |
| Single AD domain with multiple DCs | ✅ Fully supported |
| Multi-domain AD forest | ❌ Not supported |
| Multiple separate LDAP directories | ❌ Not supported |

**Why we chose NOT to match Grafana:**

1. **Security by default**: Probing all servers on "user not found" or "wrong password" increases attack surface and enables username enumeration.

2. **Most deployments are replicas**: The common enterprise pattern is HA with identical server sets, not heterogeneous directories.

3. **Don't mask infrastructure issues**: Failing over on "user not found" can hide replication lag, misconfigured search bases, or AD GC/DC inconsistencies that should be addressed at the infrastructure layer.

4. **Simpler, faster**: One server answers definitively; no need to aggregate errors or try all servers on failure.

**Future enhancement**: If customer demand requires multi-domain/heterogeneous LDAP support, this could be added as an opt-in configuration flag (e.g., `PHOENIX_LDAP_FAILOVER_MODE=heterogeneous`).

---

### 2. DN Comparison for Group Matching

| Aspect | Grafana | Phoenix | Impact |
|--------|---------|---------|--------|
| Method | `strings.EqualFold()` | RFC 4514 canonicalization | ✅ Phoenix MORE robust |
| Handles whitespace | ❌ No | ✅ Yes | Phoenix better |
| Handles multi-valued RDN | ❌ No | ✅ Yes | Phoenix better |

**Grafana** (`helpers.go`):
```go
func IsMemberOf(memberOf []string, group string) bool {
    if group == "*" { return true }
    for _, member := range memberOf {
        if strings.EqualFold(member, group) {  // Simple case-insensitive
            return true
        }
    }
    return false
}
```

**Phoenix** (`ldap.py`):
```python
def _is_member_of(canonical_user_groups: set[str], target_group: str) -> bool:
    if target_group == "*":
        return True
    target_canonical = canonicalize_dn(target_group)  # Full RFC 4514
    return target_canonical in canonical_user_groups
```

**Result**: Phoenix correctly matches DNs that differ only in whitespace or attribute ordering. Grafana may fail to match equivalent DNs.

---

### 3. No Group Match Behavior

| Aspect | Grafana | Phoenix | Impact |
|--------|---------|---------|--------|
| Behavior when no groups match | Deny + disable user | Deny access | ✅ Match |
| `SkipOrgRoleSync` option | ✅ Yes | ❌ No | ⚠️ Phoenix stricter |

**Grafana** (`ldap.go`):
```go
// validateGrafanaUser - denies access if groups configured but none match
if !server.cfg.SkipOrgRoleSync && len(server.Config.Groups) > 0 &&
    (len(user.OrgRoles) == 0 && ...) {
    return ErrInvalidCredentials
}

// SkipOrgRoleSync option allows bypassing group checks entirely
if server.cfg.SkipOrgRoleSync {
    server.log.Debug("Skipping organization role mapping.")
    return extUser, nil  // Allow login without role assignment
}
```

**Phoenix** (`ldap.py`):
```python
role = self.map_groups_to_role(groups)
if not role:
    return None  # Always deny if no matching groups
```

**Rationale**: Phoenix intentionally omits `SkipOrgRoleSync` for security - every LDAP user MUST have an explicit role assignment.

---

### 4. Role Assignment Strategy

| Aspect | Grafana | Phoenix | Impact |
|--------|---------|---------|--------|
| Multi-org support | ✅ Yes (per-org roles) | ❌ No (single role) | ✅ N/A |
| First-match-wins | Per org | Global | ✅ Equivalent |
| Wildcard `"*"` | ✅ Yes | ✅ Yes | ✅ Match |

**Grafana** (`ldap.go`):
```go
for _, group := range server.Config.Groups {
    // Only use first match FOR EACH ORG
    if extUser.OrgRoles[group.OrgId] != "" {
        continue
    }
    if IsMemberOf(memberOf, group.GroupDN) {
        extUser.OrgRoles[group.OrgId] = group.OrgRole
    }
}
```

**Phoenix** (`ldap.py`):
```python
for mapping in self.config.group_role_mappings:
    if _is_member_of(canonical_user_groups, group_dn):
        return _validate_phoenix_role(role)  # Return immediately
```

**Result**: Effectively equivalent for single-org use case. Phoenix has no multi-org concept.

---

### Summary Table

| Feature | Match | Notes |
|---------|-------|-------|
| Wildcard `"*"` support | ✅ Match | Both check wildcard first |
| Case-insensitive DN | ✅ Match | Phoenix more robust (RFC 4514) |
| First-match-wins priority | ✅ Match | Both iterate in config order |
| Multi-server failover (connection error) | ✅ Match | Both continue to next server |
| Multi-server failover (user not found) | ⚠️ Different | Grafana continues, Phoenix stops |
| Multi-server failover (wrong password) | ⚠️ Different | Grafana continues, Phoenix stops |
| No group match = deny | ✅ Match | Both deny access |
| SkipOrgRoleSync option | ⚠️ Missing | Intentionally omitted in Phoenix |
| DN canonicalization | ✅ Phoenix better | RFC 4514 vs simple string compare |

### Multi-Server Architecture Support

| Architecture | Grafana | Phoenix |
|--------------|---------|---------|
| **Replica HA** (identical servers) | ✅ Works | ✅ Works (optimal) |
| **Multi-domain** (different user sets) | ✅ Works | ⚠️ Only finds users on first responding server |
| **AD Forest** (multiple domains) | ✅ Works | ⚠️ Requires all users in primary domain |

---

## Key Compatibility Findings

### Configuration Format
- **Grafana**: TOML-based with `[[servers]]` blocks
- **Phoenix**: Environment variables with JSON for role mappings
- **Compatibility**: Same logical structure, different serialization format

### User Identification
- **Grafana**: Uses DN as primary identifier (stored in `user_auth.auth_id`)
- **Phoenix**: Uses email (simple mode) or immutable unique ID like objectGUID (enterprise mode)
- **Key difference**: Phoenix doesn't use DN for identity matching (DNs change too frequently)
- **Both**: Support email synchronization on login
- See [User Identification Strategy](./user-identification-strategy.md) for details

### TLS Security
- **Both**: Support STARTTLS and LDAPS
- **Critical**: Both require explicit TLS upgrade sequencing (see [Protocol Compliance](./protocol-compliance.md#7-starttls-implementation--security))
- **Finding**: Grafana v11.4 has STARTTLS vulnerability (tested via adversarial MITM proxy)

### DN Handling
- **Grafana**: Case-insensitive via `strings.EqualFold()`, used for user identification
- **Phoenix**: RFC 4514-compliant canonicalization for group DN matching only
- **Key difference**: Phoenix doesn't use DN for user identification (uses email or unique_id instead)

## Additional Grafana Implementation Patterns

For detailed analysis of Grafana-specific patterns that informed Phoenix's implementation, see:

- [Configuration Reference](./configuration.md) - Phoenix vs. Grafana environment variable mapping
- [Security Deep-Dive](./security.md) - LDAP injection prevention (based on Grafana patterns)
- [Protocol Compliance](./protocol-compliance.md) - TLS security testing (includes Grafana v11.4 vulnerability findings)
- [User Identification Strategy](./user-identification-strategy.md) - Email/Unique ID identification (not DN)

**Note**: The main specification document contains extensive Grafana compatibility analysis throughout, including:
- Phase 0: Grafana Compatibility Verification (lines 874-908)
- Grafana Implementation Details subsections in Appendix A (lines 1531-2416 of original document)
- Decision Reversibility Analysis comparing Grafana vs Phoenix decisions (lines 3933-4383)

