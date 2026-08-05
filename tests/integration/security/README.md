# Security Integration Tests

Locally reproducible security-control tests for Phoenix's authentication,
authorization, and protocol boundaries. Everything here is a normal
`test_*.py` collected by CI and expected to pass.

## Layout

Tests are organized by **surface** — the protocol or entry point under test.
Each directory owns the controls for one surface and grows as coverage does:

| Directory    | Surface                                                        |
|--------------|----------------------------------------------------------------|
| `oauth/`     | OAuth 2.0 authorize/token/DCR/scope/redirect boundaries        |
| `oidc/`      | OIDC login flow: issuer validation, flow integrity, callback origin |
| `mcp/`       | MCP bearer/auth boundary and protocol disclosure               |
| `ingestion/` | OTLP/gRPC ingestion authentication and role gates              |
| `pxi/`       | Direct PXI server-agent route controls                         |
| `session/`   | Cross-consumer session lifecycle (issuance, rotation, revocation) |

The orthogonal **control class** of each test is expressed with markers
(registered in `conftest.py`), applied at module scope via `pytestmark`:

| Marker              | Control class                                        |
|---------------------|------------------------------------------------------|
| `authn`             | Authentication (credential/token/session establishment) |
| `authz`             | Authorization (role, scope, audience, ownership)     |
| `input_validation`  | Input validation and canonicalization                |
| `session_management`| Session lifecycle (issuance, rotation, revocation)   |
| `disclosure`        | Information disclosure / protocol exposure           |

Surface is the directory; control class is the marker. A test never needs to
live in two places.

## Running

```sh
# Everything
uv run pytest tests/integration/security -n auto

# One surface
uv run pytest tests/integration/security/oauth -n auto

# One control class, across every surface
uv run pytest tests/integration/security -m authz
```

## Remediation contracts (added as fixes land)

Contracts for *confirmed, not-yet-fixed* issues are **not** part of this suite.
They are fail-until-fixed regressions and are intentionally excluded from CI
collection (they neither start with `test_` nor run by default) so that an
open-source repository does not advertise unpatched behavior.

As each fix lands, its contract graduates into the matching surface directory
as a normal `test_*.py` in the same PR as the fix — so the contract ends up
next to the control it proves.

## House rules

Never put real credentials, production payloads, or personal data in these
fixtures. Use the local fixtures and helpers in `tests/integration/_helpers.py`.
