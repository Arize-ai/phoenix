# Login and context

Reference for the daytona login, logout, profile, and whoami commands.

## Contents

- [Commands](#commands)
- [daytona login](#daytona-login)
- [daytona logout](#daytona-logout)
- [daytona profile](#daytona-profile)
- [daytona whoami](#daytona-whoami)

## Commands

This page documents the following commands. Global flags that apply to every command are listed under [`daytona`](./README.md#daytona).

| Command | Description |
| :------ | :---------- |
| [`daytona login`](#daytona-login) | Sign in with your browser, a device code, or a static credential |
| [`daytona logout`](#daytona-logout) | Remove the saved session and revoke its CLI-minted project keys |
| [`daytona profile`](#daytona-profile) | Manage named connections (API URL + credential + org/project context) |
| [`daytona whoami`](#daytona-whoami) | Show who you are, which credential is in use, and the selected org/project |

## daytona login

Sign in with your browser, a device code, or a static credential

Signs in to the Daytona API (https://api.daytona.com) and saves the session in
the active profile. For a test environment, point the CLI at another API with
DAYTONA_V2_API_URL (or --api-url); the profile remembers it.
--profile NAME creates a named profile: 1–64 ASCII letters, digits, '.', '_'
or '-', excluding '.' and '..'.

Default at a terminal: opens your browser (authorization code + PKCE on a
loopback redirect) and prints the URL too — nothing to type, approve and you
are done. Without a terminal (agents, CI) or inside an SSH session (where a
browser on your machine cannot reach this host's loopback redirect) the CLI
switches to the device flow automatically; --device forces it — you open a URL
on any device and enter a short code.
With JSON/YAML output or non-terminal stdout, device login prints one JSON
event with known verification_uri, verification_uri_complete, user_code and
expires_in fields before waiting. It prints no additional result on stdout.
--token: stores a static credential (a project API key, an org API key, or any
bearer the server accepts) as-is. The CLI only rejects an empty value (for
example an unset CI secret) and never inspects it otherwise; the server decides
what it may do.

After a browser or device login the CLI selects your personal organization
and its default project the first time, and remembers your last selection
afterwards. Sandbox commands use a short-lived platform token where supported;
toolbox access and other deployments use a CLI-minted project API key with a
24-hour expiry. Replacement attempts to revoke superseded keys; logout attempts
to revoke cached login-minted keys.

```shell
daytona login [flags]
```

__Examples__

```shell
daytona login
daytona login --device
daytona login --token dtn_…
```

__Flags__

| Long | Short | Type | Default | Description |
| :--- | :---- | :--- | :------ | :---------- |
| `--browser` |  | `bool` |  | force the browser (loopback) flow even inside an SSH session, for when you forward the callback port with ssh -L |
| `--client-id` |  | `string` |  | OIDC client id override (default: discovered from the API, or DAYTONA_OIDC_CLIENT_ID) |
| `--device` |  | `bool` |  | device-code login for hosts without a browser |
| `--token` |  | `string` |  | store this static credential instead of signing in |

## daytona logout

Remove the saved session and revoke its CLI-minted project keys

Deletes the active profile's saved tokens and cached workload credentials from
this machine, then attempts to revoke its cached login-minted project keys against
the profile's saved API (at most 3 seconds total). Local logout completes even
when that API is unavailable. Keys whose revocation fails expire server-side.

Does not revoke manually supplied credentials, keys an earlier release exchanged
from them, other profiles' keys, keys from other APIs, or the identity
provider's session.
Keys no longer tracked after credential replacement or identity change are
not revoked.
--api-key and API URL overrides are not used for logout cleanup.

```shell
daytona logout
```

## daytona profile

Manage named connections (API URL + credential + org/project context)

```shell
daytona profile
```

__Commands__

| Command | Description |
| :------ | :---------- |
| [`daytona profile delete`](#daytona-profile-delete) | Delete a profile and its saved credentials |
| [`daytona profile list`](#daytona-profile-list) | List profiles |
| [`daytona profile use`](#daytona-profile-use) | Make a profile the active one |

### daytona profile delete

Delete a profile and its saved credentials

Deletes the profile and its saved credentials from this machine, then attempts
to revoke the profile's cached login-minted project keys against the profile's
saved API, like logout (at most 3 seconds total). Local deletion completes even
when that API is unavailable; keys whose revocation fails expire server-side.
Deleting the active profile selects default when present, otherwise leaves none
active, and announces the resulting selection on stderr.

```shell
daytona profile delete <name>
```

### daytona profile list

List profiles

```shell
daytona profile list
```

### daytona profile use

Make a profile the active one

Make a saved profile active. Names use 1–64 ASCII letters, digits, '.', '_' or '-', excluding '.' and '..'.

```shell
daytona profile use <name>
```

## daytona whoami

Show who you are, which credential is in use, and the selected org/project

Show who you are, which credential is in use, and the selected organization
and project. org_id and project_id hold resolved IDs only; a selection given by
name is reported in org_ref / project_ref, and context_resolved is false when a
name could not be resolved to an ID.

```shell
daytona whoami
```
