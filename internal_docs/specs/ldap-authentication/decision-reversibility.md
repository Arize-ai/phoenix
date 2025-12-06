# Decision Reversibility Analysis

**Framework**: One-Way Door vs. Two-Way Door Decisions (Amazon/Bezos framework)

**One-Way Door Decisions** (Type 1):
- Difficult or impossible to reverse once committed
- Require careful analysis and deliberation upfront
- Examples: Data formats, external API contracts, backward compatibility commitments

**Two-Way Door Decisions** (Type 2):
- Easy to reverse or change with reasonable effort
- Can move quickly and iterate
- Examples: Internal code structure, library choices (with abstraction), configuration methods

---

#### Decision-by-Decision Assessment

**1. Marker Format (`\ue000LDAP(stopgap)`)**

**Decision Type**: 🚪 **ONE-WAY DOOR** (Type 1)

**Why One-Way**:
- Once LDAP users exist in production, changing the marker format requires rewriting all `oauth2_client_id` values
- Collision with real OAuth2 client IDs would cause data corruption
- Backward compatibility with existing LDAP users constrains future changes

**Risk Mitigation** (extensive upfront validation):
- ✅ Unicode PUA (U+E000-U+F8FF) guaranteed never assigned by Unicode Standard (permanent guarantee)
- ✅ OAuth2 RFC 6749 restricts client_id to ASCII (cannot contain Unicode)
- ✅ Real-world OAuth2 providers validated (none use Unicode)
- ✅ Active validation rejects PUA characters in configured OAuth2 client IDs

**Conclusion**: One-way door, but extensively validated to ensure we're choosing the right door to go through.

---

**2. Allow Sign-Up Default (`true`)**

**Decision Type**: 🚪 **ONE-WAY DOOR** (Type 1)

**Why One-Way**:
- Once LDAP is released with `allow_sign_up=true` as default, existing users depend on this behavior
- Changing the default to `false` in a later release would break existing deployments (auto-sign-up suddenly stops working)
- Organizations that deployed with the expectation of auto-sign-up would face user complaints
- Configuration file compatibility: Cannot safely change default without breaking semantic versioning

**Risk Mitigation**:
- ✅ Matches Grafana's default (`allow_sign_up: true` in `conf/defaults.ini`)
- ✅ Explicit opt-out mechanism available (`PHOENIX_LDAP_ALLOW_SIGN_UP="false"`)
- ✅ Well-documented in configuration reference
- ✅ Security-conscious organizations can disable before first deployment
- ✅ Tested in unit tests (`tests/unit/test_config.py::test_allow_sign_up_parsing`)

**Security Consideration**: While `true` is more permissive, it's the right default because:
1. **Grafana compatibility**: Users expect this behavior
2. **Least surprise**: Auto-sign-up is the expected behavior for LDAP (unlike OAuth2)
3. **Easy to lock down**: Organizations requiring pre-provisioning can set `allow_sign_up=false` from day one
4. **Generic error messages**: Username enumeration is still prevented regardless of setting

**Conclusion**: One-way door, but the default matches industry standard (Grafana) and provides explicit opt-out for security-conscious deployments.

#### Allow Sign-Up Behavior: Grafana vs Phoenix

**Grafana's Implementation** ([source](https://github.com/grafana/grafana/blob/84a07be6e4e1acd8f064c3b390c30188d5703afc/pkg/services/authn/authnimpl/sync/user_sync.go#L280-L327)):

When user logs in via LDAP:
1. **LDAP authentication** → retrieves DN, email, name, groups from LDAP server ([source](https://github.com/grafana/grafana/blob/84a07be6e4e1acd8f064c3b390c30188d5703afc/pkg/services/ldap/ldap.go#L486))
   ```go
   extUser := &login.ExternalUserInfo{
       AuthModule: login.LDAPAuthModule,
       AuthId:     user.DN,  // Distinguished Name, e.g. "cn=john,ou=users,dc=example,dc=com"
       // ... email, name, groups
   }
   ```

2. **Multi-step user lookup** ([source](https://github.com/grafana/grafana/blob/84a07be6e4e1acd8f064c3b390c30188d5703afc/pkg/services/authn/authnimpl/sync/user_sync.go#L622-L672)):
   - **Step 1**: Check `user_auth` table for `auth_id=DN` and `auth_module="ldap"` ([line 627-638](https://github.com/grafana/grafana/blob/84a07be6e4e1acd8f064c3b390c30188d5703afc/pkg/services/authn/authnimpl/sync/user_sync.go#L627-L638))
   - **Step 2**: If not found, look up by email in `user` table ([line 682-687](https://github.com/grafana/grafana/blob/84a07be6e4e1acd8f064c3b390c30188d5703afc/pkg/services/authn/authnimpl/sync/user_sync.go#L682-L687))
   - **Step 3**: If still not found, look up by login/username ([line 690-695](https://github.com/grafana/grafana/blob/84a07be6e4e1acd8f064c3b390c30188d5703afc/pkg/services/authn/authnimpl/sync/user_sync.go#L690-L695))
   - **Step 4**: If still not found → `ErrUserNotFound` ([line 697-699](https://github.com/grafana/grafana/blob/84a07be6e4e1acd8f064c3b390c30188d5703afc/pkg/services/authn/authnimpl/sync/user_sync.go#L697-L699))

3. **If user not found and `allow_sign_up=false`** → reject login ([source](https://github.com/grafana/grafana/blob/84a07be6e4e1acd8f064c3b390c30188d5703afc/pkg/services/authn/authnimpl/sync/user_sync.go#L296-L298)):
   ```go
   if errors.Is(err, user.ErrUserNotFound) {
       if !id.ClientParams.AllowSignUp {
           s.log.FromContext(ctx).Warn("Failed to create user, signup is not allowed for module", 
               "auth_module", id.AuthenticatedBy, "auth_id", id.AuthID)
           return errUserSignupDisabled.Errorf("%w", errSignupNotAllowed)
       }
   }
   ```

4. **If user found** → creates/updates `user_auth` table linking user to LDAP, syncs attributes ([source](https://github.com/grafana/grafana/blob/84a07be6e4e1acd8f064c3b390c30188d5703afc/pkg/services/authn/authnimpl/sync/user_sync.go#L317-L326), [line 467](https://github.com/grafana/grafana/blob/84a07be6e4e1acd8f064c3b390c30188d5703afc/pkg/services/authn/authnimpl/sync/user_sync.go#L467)):
   ```go
   needsConnectionCreation := userAuth == nil  // No existing user_auth record
   // ... update user attributes (email, name, role) ...
   s.upsertAuthConnection(ctx, usr.ID, identity, needsConnectionCreation)
   ```

**Key insight**: Grafana allows admins to create users via **any authentication method** (local, OAuth2, etc.), then automatically "converts" them to LDAP on first LDAP login by creating an `auth_info` record.

**Grafana Configuration** ([source](https://github.com/grafana/grafana/blob/84a07be6e4e1acd8f064c3b390c30188d5703afc/docs/sources/setup-grafana/configure-access/configure-authentication/ldap/index.md#L40-L52)):
```ini
[auth.ldap]
enabled = true
config_file = /etc/grafana/ldap.toml
allow_sign_up = true  # Default: true
```
> "After enabling LDAP, the default behavior is for Grafana users to be created automatically upon successful LDAP authentication. If you prefer for only existing Grafana users to be able to sign in, you can change `allow_sign_up` to `false`."

**Phoenix's Implementation Difference**:

Due to zero-migration constraints, Phoenix **cannot** convert LOCAL users to LDAP:
- **Schema constraint**: LOCAL users have `NOT NULL` constraints on `password_hash` and `password_salt`
- **Storage difference**: LDAP users stored as `OAuth2User` with `oauth2_client_id="\ue000LDAP(stopgap)"`
- **No conversion path**: Cannot change `auth_method` from `LOCAL` to `OAUTH2` without migration

**Phoenix's Approach**:

| Scenario | Grafana | Phoenix (Zero-Migration) |
|----------|---------|--------------------------|
| **`allow_sign_up=true`** (default) | Auto-creates user on first LDAP login | ✅ Same: Auto-creates user via `/auth/ldap/login` |
| **`allow_sign_up=false`** | Admin creates user (any auth method), LDAP login converts to LDAP | Admin creates user via GraphQL `createUser(auth_method: LDAP)` |
| **User lookup strategy** | 1) DN in `user_auth`, 2) email, 3) username | **Email only** (authoritative unique identifier) |
| **Admin workflow** | Create with email+username → LDAP discovers attributes | ✅ Same: Create with email+displayName → LDAP syncs |
| **Email collision** | Allows conversion (same user, different auth) | ⚠️ Rejects login (prevents hijacking) |

**Phoenix's Implementation** (`src/phoenix/server/api/routers/auth.py`):

When user logs in via LDAP:
1. **LDAP authentication** → retrieves email, name, groups from LDAP server

2. **Direct email lookup** (email is unique identifier):
   ```python
   # Email lookup (returned from LDAP authentication)
   user = await session.scalar(
       select(models.User)
       .where(models.User.oauth2_client_id == LDAP_CLIENT_ID_MARKER)
       .where(func.lower(models.User.email) == user_info["email"].lower())
   )
   ```

3. **If user not found and `allow_sign_up=false`** → reject login:
   ```python
   if not user:
       if not ldap_config.allow_sign_up:
           raise HTTPException(status_code=401, detail="Invalid username and/or password")
   ```

4. **Security check**: Prevent LDAP from hijacking LOCAL/OAuth2 users:
   ```python
   # When creating new user (allow_sign_up=true)
   existing_user = await session.scalar(
       select(models.User).where(func.lower(models.User.email) == email.lower())
   )
   if existing_user and existing_user.oauth2_client_id != LDAP_CLIENT_ID_MARKER:
       raise HTTPException(status_code=401, detail="Invalid username and/or password")
   ```

5. **If user found** → update attributes (email, display name, role)

**Phoenix User Creation Mutation** (`src/phoenix/server/api/mutations/user_mutations.py`):
```python
if input.auth_method is AuthMethod.LDAP:
    # LDAP users are stored with special Unicode marker
    from phoenix.server.ldap import LDAP_CLIENT_ID_MARKER
    
    user = models.OAuth2User(
        email=email,                          # Unique identifier
        username=input.username,              # Display name (will sync from LDAP)
        oauth2_client_id=LDAP_CLIENT_ID_MARKER,  # Identifies as LDAP
        oauth2_user_id=None,                  # NULL until first login (then upgraded to DN)
    )
```

**Tradeoffs**:

| Aspect | Grafana (Flexible) | Phoenix (Zero-Migration) |
|--------|-------------------|--------------------------|
| **Admin workflow (`allow_sign_up=false`)** | Create user (any auth method) → auto-converts on LDAP login | Must create as LDAP user explicitly |
| **Email fallback** | ✅ Yes (looks up by email if DN not found) | ✅ Yes (looks up by email if username not found) |
| **Cross-auth flexibility** | User can switch from LOCAL to LDAP seamlessly | ❌ Cannot switch (schema constraints) |
| **Security** | Flexible (potential confusion) | Strict (prevents accidental hijacking) |
| **Database complexity** | Separate `user` + `user_auth` tables | Single `users` table (reuses OAuth2 columns) |
| **Migration path** | Already has separation | Can migrate to Approach 2 later ([Appendix H](#appendix-h-approach-1--2-migration-plan)) |

**Why Phoenix's Approach is Acceptable**:
1. **Zero-migration MVP**: Unblocks corporate users immediately without schema changes
2. **Clear auth method**: Admins explicitly specify `auth_method: LDAP` (more intentional)
3. **Security**: Prevents accidental account hijacking (LDAP can't take over LOCAL users)
4. **Migration path exists**: Can move to Grafana's flexible model in Approach 2 if needed

**Grafana References**:
- [User sync logic](https://github.com/grafana/grafana/blob/84a07be6e4e1acd8f064c3b390c30188d5703afc/pkg/services/authn/authnimpl/sync/user_sync.go#L280-L327)
- [LDAP configuration docs](https://github.com/grafana/grafana/blob/84a07be6e4e1acd8f064c3b390c30188d5703afc/docs/sources/setup-grafana/configure-access/configure-authentication/ldap/index.md#L40-L52)
- [LDAP service config](https://github.com/grafana/grafana/blob/84a07be6e4e1acd8f064c3b390c30188d5703afc/pkg/services/ldap/service/ldap.go#L96)
- [Settings struct](https://github.com/grafana/grafana/blob/84a07be6e4e1acd8f064c3b390c30188d5703afc/pkg/services/ldap/settings.go#L20-L26)

---

**3. Library Choice (ldap3)**

**Decision Type**: 🚪🚪 **TWO-WAY DOOR** (Type 2)

**Why Two-Way**:
- `LDAPAuthenticator` class abstracts library details
- Swapping libraries only requires changing one module (`src/phoenix/server/ldap.py`)
- Interface-based design minimizes coupling throughout codebase
- No external API exposure of library-specific types

**Library Quality** (reduces likelihood of needing to swap):
- RFC-compliant
- Actively maintained
- Pure Python implementation

**Conclusion**: Two-way door. Abstraction layer maintains flexibility to swap libraries if needed.

---

**4. Environment Variable vs TOML Configuration**

**Decision Type**: **MIXED**

**Configuration Method** = 🚪🚪 **TWO-WAY DOOR**:
- Can add TOML file support later without breaking env var users
- Precedence order: env vars override file config (backward compatible)
- Both configuration methods can coexist simultaneously

**Environment Variable Names** = 🚪 **ONE-WAY DOOR**:
- Once released, changing env var names is a breaking change for users
- Self-hosted users will configure these in deployment files/scripts
- Need to choose names carefully upfront

**What Would Break if We Changed These Variables?**

| Change | User Impact | Mitigation Effort |
|--------|-------------|-------------------|
| Rename `PHOENIX_LDAP_*` → `PHOENIX_AUTH_LDAP_*` | 🔴 **BREAKING**: All user configs invalid | High (deprecation period, docs, migration guide) |
| Change `GROUP_ROLE_MAPPINGS` JSON structure | 🔴 **BREAKING**: All role mappings fail | High (version detection, auto-migration) |
| Change `role` values from uppercase to lowercase | 🔴 **BREAKING**: All role mappings fail | High (unless we add case-insensitive parsing) |
| Add new optional variable | 🟢 **SAFE**: Backward compatible | None (users adopt gradually) |
| Change default value (e.g., `PORT` 389→636) | 🟡 **RISKY**: Silent behavior change | Medium (document in release notes, warn on upgrade) |
| Remove optional variable | 🔴 **BREAKING**: Users relying on it fail | High (deprecation period required) |

#### Contract Guarantees

**What we commit to maintaining** (breaking these requires major version bump):
1. ✅ All `PHOENIX_LDAP_*` variable names will remain unchanged
2. ✅ `GROUP_ROLE_MAPPINGS` JSON structure matches Grafana's `GroupToOrgRole` (minus `org_id`)
   - **ONE-WAY DOOR**: Field names `group_dn` and `role` are locked in
3. ✅ `role` values are **Phoenix roles**: `"ADMIN"`, `"MEMBER"`, `"VIEWER"` (uppercase)
   - **ONE-WAY DOOR**: Role values are locked in (Phoenix-native, not Grafana's "Admin"/"Editor"/"Viewer")
4. ✅ Boolean values use strings `"true"`/`"false"` (case-insensitive)
5. ✅ Multi-server format is comma-separated in `HOST`
6. ✅ Search filters use `%s` as username/DN placeholder
7. ✅ Defaults match Grafana's production recommendations (TLS on, verify on, port 389, timeout 10s)

**Naming Validation**:
- ✅ Follows Phoenix convention: `PHOENIX_*` prefix
- ✅ Clear, descriptive names: `PHOENIX_LDAP_HOST`, `PHOENIX_LDAP_BIND_DN`
- ✅ Consistent with existing patterns: Similar to `PHOENIX_OAUTH2_*` vars
- ✅ Namespaced: `LDAP_` prefix prevents conflicts
- ✅ **No collision with Grafana**: Grafana doesn't use direct env vars (only TOML file with `${VAR}` interpolation), so Phoenix's naming is independent

**Grafana vs Phoenix Configuration Comparison**:

| Aspect | Grafana | Phoenix (MVP Spec) |
|--------|---------|-------------------|
| **Primary method** | TOML file ([ldap.toml](https://github.com/grafana/grafana/blob/main/conf/ldap.toml)) | Environment variables |
| **Config file specification** | `[auth.ldap] config_file = /etc/grafana/ldap.toml` | `PHOENIX_LDAP_*` env vars |
| **Multi-server support** | Each server has unique config | All servers share same config |
| **Group mappings** | Natural TOML array | JSON string in env var |
| **Env var interpolation** | ✅ In TOML: `${ENV_PASSWORD}` | ✅ Direct env vars |
| **Use case** | Heterogeneous LDAP forests | Replica failover only |

**Verified from Grafana source** (`pkg/setting/setting.go:1480-1488`, `conf/defaults.ini:987-991`, `pkg/services/ldap/testdata/ldap.toml:10`):
```ini
# Grafana main config (defaults.ini)
[auth.ldap]
enabled = false
config_file = /etc/grafana/ldap.toml
allow_sign_up = true
```

```toml
# Grafana LDAP config (ldap.toml)
[[servers]]
host = "127.0.0.1"
bind_dn = "cn=admin,dc=grafana,dc=org"
bind_password = '${ENV_PASSWORD}'  # Env var interpolation within TOML
```

**Key Finding**: Grafana does NOT use direct environment variables like `GRAFANA_LDAP_HOST`. It only uses env var interpolation WITHIN the TOML file.

**Critical Limitation**:

From [ldap_multiple.toml](https://raw.githubusercontent.com/grafana/grafana/84a07be6e4e1acd8f064c3b390c30188d5703afc/conf/ldap_multiple.toml), Grafana supports **different configurations per server**:
```toml
[[servers]]
host = "10.0.0.1"
bind_dn = "cn=admin,dc=forest1,dc=com"
[[servers.group_mappings]]
group_dn = "cn=admins,dc=forest1,dc=com"

[[servers]]  # DIFFERENT config!
host = "10.0.0.2"
bind_dn = "cn=admin,dc=forest2,dc=com"
[[servers.group_mappings]]
group_dn = "cn=editors,dc=forest2,dc=com"
```

Phoenix's env var approach **cannot** support this - assumes all servers are identical replicas.

**Tradeoffs**:

**Option A: Keep Env Vars** (Current Spec)
- ✅ Consistent with Phoenix patterns (`PHOENIX_OAUTH2_*`, etc.)
- ✅ Simpler for most users (single LDAP server)
- ✅ Container-friendly (12-factor app pattern)
- ⚠️ **Limitation**: Only supports replica failover, not heterogeneous servers
- ⚠️ Group mappings as JSON string (less readable)
- ✅ Can add TOML later without breaking changes

**Option B: Use TOML File**
- ✅ Full Grafana compatibility
- ✅ Supports heterogeneous servers
- ✅ More readable for complex configs
- ⚠️ Diverges from Phoenix patterns
- ⚠️ Requires file management (mounting in containers)
- ✅ Can add env var fallback later without breaking changes

**Option C: Hybrid** (Recommended for Future)
- Start with env vars (MVP)
- Add TOML file support in post-MVP
- Precedence: `PHOENIX_LDAP_CONFIG_FILE` > env vars
- Maintains backward compatibility

**MVP Recommendation**: Use env vars, document the replica-only limitation, plan for TOML in future.

**Conclusion**: 
- **Configuration method**: Two-way door - start with env vars, add TOML later
- **Specific env var names**: One-way door - must be correct at release
- **Documented limitation**: Multi-server assumes replicas (identical config)

---

**5. Approach 1 Semantic Debt**

**Decision Type**: 🚪🚪 **TWO-WAY DOOR** (Type 2)

**Why Two-Way**:
- Migration path is straightforward (Approach 1 → Approach 2)
- Data migration script is simple (rewrite `oauth2_client_id` to dedicated columns)
- No backward compatibility trap - we control both schema and code
- Can execute migration at any time with coordination

**Semantic Debt If We Don't Migrate** (deferred work):
- `auth_method='OAUTH2'` for LDAP users creates developer confusion
- Cannot use polymorphic `LDAPUser` class
- Schema columns don't reflect usage
- Code quality debt accumulates

**Migration Path**:
1. Add dedicated LDAP column (`ldap_username`)
2. Backfill existing LDAP users
3. Update code to use `LDAPUser` polymorphic class
4. (Optional) Clean up old code paths

**See**: [Appendix H](#appendix-h-approach-1--2-migration-plan) for single-transaction Alembic migration (recommended) or phased migration for large installations.

**Conclusion**: Two-way door. Choosing Approach 1 doesn't lock us in - we can migrate to Approach 2 whenever code quality becomes a priority.

---

**6. No Polymorphic LDAPUser (Approach 1)**

**Decision Type**: 🚪🚪 **TWO-WAY DOOR** (Type 2)

**Why Two-Way**:
- This is the same migration as item #5 (Approach 1 → Approach 2)
- Once we add `auth_method='LDAP'` and dedicated columns, we can add `LDAPUser` class
- No backward compatibility trap

**Architectural Debt If We Don't Migrate** (deferred work):
- Cannot use polymorphic `LDAPUser` class
- Cannot use `isinstance(user, LDAPUser)` checks
- Cannot use `session.query(LDAPUser).all()` queries
- Inconsistent with `LocalUser`/`OAuth2User` patterns

**Resolution**:
- Same migration as item #5 unlocks polymorphism
- Add `LDAPUser` class with `polymorphic_identity="LDAP"`

**Conclusion**: Two-way door. Polymorphism can be added later with the Approach 2 migration.

---

#### Overall Decision Analysis

**Framework Summary**: One-Way Door (Type 1) vs. Two-Way Door (Type 2) Decisions

| Decision | Door Type | Analysis |
|----------|-----------|----------|
| **Configuration Structure** | | |
| Marker format (`\ue000LDAP(stopgap)`) | 🚪 **ONE-WAY** | Once production data exists, changing format requires data migration. **Risk: Very Low** (extensively validated for collision-free operation) |
| Env var names (PHOENIX_LDAP_*) | 🚪 **ONE-WAY** | Once released, changing names breaks user configs. **Risk: Very Low** (follows established Phoenix conventions) |
| JSON field names (`group_dn`, `role`) | 🚪 **ONE-WAY** | Public API contract. **Risk: Very Low** (Phoenix uses `role` not `org_role` since no org concept) |
| Role values (ADMIN/MEMBER/VIEWER) | 🚪 **ONE-WAY** | Configuration contract. **Risk: Very Low** (matches Phoenix's existing roles) |
| **Behavioral Contracts** | | |
| Wildcard "*" matches all users | 🚪 **ONE-WAY** | Users configure based on this. **Risk: Very Low** |
| Case-insensitive DN matching | 🚪 **ONE-WAY** | Configuration parsing behavior. **Risk: Very Low** (Grafana-compatible, LDAP standard) |
| First-match-wins priority | 🚪 **ONE-WAY** | Determines role assignment. **Risk: Very Low** (Grafana-compatible, well-documented) |
| Email fallback for display name | 🚪 **ONE-WAY** | Users may depend on this. **Risk: Very Low** (sensible default, tested) |
| Multi-server comma-separated format | 🚪 **ONE-WAY** | Parsing contract. **Risk: Very Low** (simple, standard pattern) |
| Filter placeholder `%s` format | 🚪 **ONE-WAY** | Query construction contract. **Risk: Very Low** (standard across LDAP tools) |
| **Implementation Flexibility** | | |
| Library choice (ldap3) | 🚪🚪 **TWO-WAY** | Abstraction layer allows swapping libraries without codebase changes. |
| Env var config method | 🚪🚪 **TWO-WAY** | Can add TOML/file-based config later while maintaining env var support. |
| Approach 1 semantic debt | 🚪🚪 **TWO-WAY** | Can migrate to Approach 2 anytime with data migration + code updates. |
| No polymorphism (Approach 1) | 🚪🚪 **TWO-WAY** | Can add polymorphism with same Approach 2 migration. |

**Key Insights**:

**One-Way Door Decisions** (requires careful upfront analysis):
- **Marker format** (`\ue000LDAP(stopgap)`): Changing requires data migration
  - ✅ Extensively validated (Unicode PUA guarantees, OAuth2 spec analysis, real-world provider validation)
  - ✅ Active defense (validation rejects PUA in OAuth2 client IDs)
  - ✅ Low risk: All evidence points to this being the correct choice
- **Environment variable names** (`PHOENIX_LDAP_*`): Changing breaks user configs
  - ✅ Follows Phoenix conventions (`PHOENIX_*` prefix)
  - ✅ Clear, descriptive names match industry standards
  - ✅ Consistent with existing `PHOENIX_OAUTH2_*` patterns
  - ✅ Low risk: Names are standard and unlikely to need change

**Two-Way Door Decisions** (can iterate and improve):
- **Everything else**: All other decisions can be changed/extended later
  - Library: Swap via abstraction layer
  - Configuration method: Add file-based (TOML) alongside env vars
  - Schema: Add columns in future migrations (Approach 1 → 2)
  - Code structure: Add polymorphism with migration

**Approach 1 vs. Approach 2**:
- **Both are two-way doors** (from Approach 1, we can migrate to Approach 2)
- **Difference**: Timing of architecture work (now vs. later)
- **Neither locks us in**: Both maintain flexibility for future changes
- **Choice**: Release speed (Approach 1) vs. upfront code quality (Approach 2)

---

### Appendix F: Security Deep-Dive
