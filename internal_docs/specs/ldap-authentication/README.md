# LDAP Authentication - Appendices

Detailed technical references for the [LDAP Authentication specification](../ldap-authentication.md).

## Quick Reference

**New to LDAP?**
- [LDAP Primer](./ldap-primer.md) - **LDAP fundamentals for engineers familiar with OIDC** (start here!)

**Most Frequently Used**:
- [Configuration Reference](./configuration.md) - Environment variables, Phoenix vs. Grafana comparison
- [Protocol Compliance](./protocol-compliance.md) - STARTTLS security, DN canonicalization, real-directory testing
- [Security Deep-Dive](./security.md) - Threat model, LDAP injection prevention
- [Authentication Framework](./authentication-framework.md) - Multi-method auth, cross-auth security, admin provisioning

**Implementation**:
- [Code Examples](./code-examples.md)
- [Frontend Implementation](./frontend-implementation.md)
- [Phoenix Integration](./phoenix-integration.md)

**Design & Architecture**:
- [Database Schema](./database-schema.md)
- [User Identification Strategy](./user-identification-strategy.md)
- [Optional Email for LDAP Users](./optional-email.md) - Support for LDAP directories without email attribute

**Research**:
- [Grafana Comparison](./grafana-comparison.md)
- [Background Sync (Future)](./background-sync-future.md)

**Roadmap**:
- [Future Improvements](./future-improvements.md) - Post-MVP enhancements (password policy, metrics, retry logic, nested groups)
