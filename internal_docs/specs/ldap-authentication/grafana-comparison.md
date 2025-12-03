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

## Key Compatibility Findings

### Configuration Format
- **Grafana**: TOML-based with `[[servers]]` blocks
- **Phoenix**: Environment variables with JSON for role mappings
- **Compatibility**: Same logical structure, different serialization format

### User Identification
- **Both**: Use DN as primary identifier
- **Both**: Support email synchronization
- **Difference**: Grafana uses separate `user_auth` table; Phoenix uses existing `oauth2_user_id` column

### TLS Security
- **Both**: Support STARTTLS and LDAPS
- **Critical**: Both require explicit TLS upgrade sequencing (see [Protocol Compliance](./protocol-compliance.md#7-starttls-implementation--security))
- **Finding**: Grafana v11.4 has STARTTLS vulnerability (tested via adversarial MITM proxy)

### DN Handling
- **Grafana**: Case-insensitive via `strings.EqualFold()`
- **Phoenix**: RFC 4514-compliant canonicalization (case, whitespace, RDN ordering)
- **Result**: Phoenix more RFC-compliant

## Additional Grafana Implementation Patterns

For detailed analysis of Grafana-specific patterns that informed Phoenix's implementation, see:

- [Configuration Reference](./configuration.md) - Phoenix vs. Grafana environment variable mapping
- [Security Deep-Dive](./security.md) - LDAP injection prevention (based on Grafana patterns)
- [Protocol Compliance](./protocol-compliance.md) - TLS security testing (includes Grafana v11.4 vulnerability findings)
- [User Identification Strategy](./user-identification-strategy.md) - DN + Email hybrid approach

**Note**: The main specification document contains extensive Grafana compatibility analysis throughout, including:
- Phase 0: Grafana Compatibility Verification (lines 874-908)
- Grafana Implementation Details subsections in Appendix A (lines 1531-2416 of original document)
- Decision Reversibility Analysis comparing Grafana vs Phoenix decisions (lines 3933-4383)

