# Background LDAP Sync (Future)

**Comprehensive design for optional background LDAP synchronization** - A future enhancement for enterprise deployments.

## Overview

Background LDAP sync is a **post-MVP feature** that automatically synchronizes all LDAP users with the directory on a scheduled basis (e.g., nightly). This is based on Grafana's Enterprise-only background sync feature.

## What It Does

1. **Scheduled Execution**: Runs on a cron schedule (e.g., daily at 1 AM)
2. **User Synchronization**: Iterates through all LDAP users in the database
3. **Attribute Updates**: Syncs email, name, and role from LDAP directory
4. **Automatic Deprovisioning**: Disables users removed from LDAP and revokes their sessions
5. **Re-enabling**: Re-activates previously disabled users found in LDAP

## Implementation Pattern

Phoenix would use the existing `DaemonTask` pattern (same as `TraceDataSweeper`, `TokenStore`, etc.):

```python
class LDAPUserSynchronizer(DaemonTask):
    """Background task to sync LDAP users with the database."""
    
    async def _run(self) -> None:
        while self._running:
            await self._sleep_until_next_run()  # Based on cron expression
            await self._sync_all_ldap_users()
```

## Configuration

```bash
# Enable background sync (default: false)
PHOENIX_LDAP_BACKGROUND_SYNC_ENABLED="true"

# Cron schedule (default: "0 1 * * *" = 1 AM daily)
PHOENIX_LDAP_BACKGROUND_SYNC_CRON="0 1 * * *"
```

## When to Use

**Enable for**:
- Large organizations (1000+ LDAP users)
- Strict security policies requiring immediate deprovisioning
- Users who don't login frequently

**Skip for**:
- Small deployments (<100 users)
- Users login frequently (already synced on login)
- LDAP server rate limits or network costs

## Implementation Roadmap

- **Phase 1 (MVP)**: Login-time sync only ✅
- **Phase 2 (Post-MVP)**: Manual sync API endpoint
- **Phase 3 (Future)**: Automatic background sync

**Decision**: Defer until users request it. Most Phoenix installations are small-to-medium and login-time sync is sufficient.

**Note**: For complete implementation details (including detailed code examples, metrics, performance tuning, batch processing), see the "Phoenix Background Sync Design (Future)" section in the original comprehensive document (lines 1849-2356).

