# Authentication (TypeScript SDK)

Authenticate the Daytona SDKs, CLI, and API to create sandboxes.

SDK, CLI, and API requests authenticate with a project [API key](./api-keys.md). The key identifies the [project](./projects.md) that owns the sandboxes you create and carries the [permissions](./api-keys.md#scopes) a request may use.

## Contents

- [Get an API key](#get-an-api-key)
- [Environment variables](#environment-variables)
- [Authenticate the SDK](#authenticate-the-sdk)
- [Authenticate the CLI](#authenticate-the-cli)
- [Authenticate API requests](#authenticate-api-requests)

## Get an API key

1. Go to [Daytona Dashboard ↗](https://app.daytona.com/dashboard/keys)
2. Select the project in the header switcher
3. Click **Create API Key**
4. Enter **Key Name**
5. Select **write:sandboxes** permission
6. Click **Create API Key**
7. Copy and save the API key as an environment variable

## Environment variables

Environment variables are named text values that a process inherits from the process that started it. A program can read its configuration from them without changes to its source code. Daytona resolves configuration in order of precedence:

1. Configuration in code
2. Environment variables

| **Variable**              | **Description**                                                                                |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| **`DAYTONA_API_KEY`**     | Your Daytona API key. <br /> Required unless `DAYTONA_JWT_TOKEN` is set                     |
| **`DAYTONA_JWT_TOKEN`**   | The OIDC token of a signed-in user instead of an API key, [exchanged](./api-keys.md#exchange-a-token) for a project token. <br /> Optional; needs `DAYTONA_PROJECT_ID` |
| **`DAYTONA_PROJECT_ID`**  | The project a JWT is scoped to. <br /> Required with `DAYTONA_JWT_TOKEN`                   |

**.env:**

```dotenv
DAYTONA_API_KEY=YOUR_API_KEY
```

> **Notes:**
>
> - **Compatibility:** The SDKs and the CLI read only the process environment, not `.env` files.
> - **Order:** Load the file into the process environment before the Daytona client starts, for example with the `python-dotenv` package in Python or with `node --env-file=.env` in Node.js.

**Bash/Zsh:**

```bash
export DAYTONA_API_KEY=YOUR_API_KEY
```

**Windows PowerShell:**

```powershell
$env:DAYTONA_API_KEY="YOUR_API_KEY"
```

## Authenticate the SDK

Construct the client without arguments to read the environment variables, or pass the configuration in code. Every call made through the client sends the API key or, with a JWT, a short-lived project token the client exchanges the JWT for.

```typescript
import { Daytona } from '@daytona/sdk'

// Using environment variables
const daytona = new Daytona()

// Using explicit configuration
const daytonaWithConfig = new Daytona({ apiKey: 'YOUR_API_KEY' })

// Pick the region per create
const sandbox = await daytonaWithConfig.v2.create({ region: 'earth' })
```

| **Parameter** | **Description** |
| --- | --- |
| `apiKey` | Sets the API key that authenticates the client.<br />**Default:** the DAYTONA_API_KEY environment variable |
| `jwtToken` | Sets the OIDC token of a signed-in user in place of an API key.<br />**Default:** the DAYTONA_JWT_TOKEN environment variable |
| `projectId` | Sets the project that the JWT is scoped to.<br />**Default:** the DAYTONA_PROJECT_ID environment variable |
| `region` | Sets the region.<br />**Default:** the project's default region, then the organization's, then `earth`<br />**Value:** `earth`, `us`, `us-east`, `us-east-ash-1`, `us-east-bos-1`, `us-east-iad-1`, or the ID of a [BYOC region](./bring-your-own-compute.md) of the organization<br />**Example:** `'earth'` |
| `requestTimeoutSeconds` | Sets the time limit of one request in seconds.<br />**Default:** `60`<br />**Value:** `0` for no limit<br />**Example:** `120` |

> **Notes:**
>
> - **Permissions:** The request requires the `write:sandboxes` permission.
> - **Compatibility:** The client takes either an API key or a JWT with a project ID, not both.

### Close the client

Close the client when your program no longer needs it. Closing releases the network resources the client holds between calls, such as the connection that reports sandbox state changes. It does not stop or delete any sandbox, and closing the client twice does nothing.

```typescript
import { Daytona } from '@daytona/sdk'

const daytona = new Daytona()
const sandbox = await daytona.v2.create()

// Close the client explicitly
await daytona.close()
```

> **Notes:**
>
> - **Clients:** Declare the client with await using to close it when the scope exits.

## Authenticate the CLI

Sign in once and the CLI saves the session in its active profile, so following commands need no key or flags. After a browser or device login, the CLI selects your personal organization and its default project the first time and remembers your last selection afterwards. Sandbox commands use a short-lived platform token where the deployment issues one. Toolbox access, and sandbox commands on other deployments, use a project API key the CLI mints on your behalf with a 24-hour expiry; logging out attempts to revoke these keys.

**CLI:**

```bash
# Browser login
daytona login --api-url https://api.daytona.com

# Device-code login on a host without a browser
daytona login --device --api-url https://api.daytona.com

# Store an API key in the active profile
daytona login --token YOUR_API_KEY --api-url https://api.daytona.com

# Confirm who you are and what is selected
daytona whoami

# Create a sandbox with the saved session
daytona sandbox create

# Remove the saved session from this machine
daytona logout
```

```bash
# Using environment variables (DAYTONA_API_KEY, DAYTONA_V2_API_URL)
daytona sandbox create

# Using explicit flags
daytona sandbox create --api-key YOUR_API_KEY --api-url https://api.daytona.com
```

| **Flag** | **Description** |
| --- | --- |
| `--api-key` | Sends a static credential in place of the saved login.<br />**Default:** the DAYTONA_API_KEY environment variable |
| `--api-url` | Sets the API base URL.<br />**Default:** the DAYTONA_V2_API_URL environment variable, then the URL saved in the profile, then `https://api.daytona.com` |
| `--device` | Signs in with a device code on a host without a browser. |
| `--profile` | Selects a saved profile other than the active one.<br />**Default:** the DAYTONA_PROFILE environment variable, then the active profile, then the profile named default<br />**Format:** 1 to 64 ASCII letters, digits, periods, underscores, and hyphens, other than a single or double period<br />**Example:** `work` |
| `--token` | Stores a static credential in the profile in place of a sign-in. |

> **Notes:**
>
> - **Effects:** Logging out revokes only the API keys that the CLI created for the session, not a credential stored with --token.
> - **Clients:** Without a terminal, daytona login signs in with a device code.

### Profiles

A profile is a named connection: an API URL, a credential, and the selected organization and project. One machine can keep several profiles, for example one per organization or deployment, and switch between them without signing in again. A command uses the profile it names, then the profile in the environment, then the active profile, then the profile named default. Signing in to a new profile creates it, and makes it active only when no profile is active yet. Deleting the active profile makes the default profile active when it exists, otherwise no profile is active.

**CLI:**

```bash
# Sign in to a second profile
daytona login --profile work --api-url https://api.daytona.com

# List profiles
daytona profile list

# Run one command with another profile
daytona sandbox list --profile work

# Make a profile active for following commands
daytona profile use work

# Delete a profile and its saved credentials
daytona profile delete work
```

| **Flag** | **Description** |
| --- | --- |
| `--profile` | Selects a saved profile other than the active one.<br />**Default:** the DAYTONA_PROFILE environment variable, then the active profile, then the profile named default<br />**Format:** 1 to 64 ASCII letters, digits, periods, underscores, and hyphens, other than a single or double period<br />**Example:** `work` |

> **Notes:**
>
> - **Prerequisites:** A profile named by --profile or DAYTONA_PROFILE must exist, unless daytona login creates it.
> - **Effects:** Deleting a profile tries to revoke the CLI's API keys for it, which otherwise expire after 24 hours.
> - **Confirmation:** daytona profile delete asks for confirmation at a terminal and requires --yes otherwise.

### Confirmation prompts

At a terminal, the CLI asks for confirmation before destructive and billable commands. The setting applies to every profile on the machine. Turning it off removes the prompt only: when the CLI is not attached to a terminal, prints JSON or YAML, or runs with the CI environment variable set, those commands still require an explicit confirmation.

**CLI:**

```bash
# Turn off confirmation prompts
daytona config set confirm false

# Print the current value
daytona config get confirm

# Print the directory that holds profiles, credentials, and settings
daytona config path
```

| **Flag** | **Description** |
| --- | --- |
| `confirm` | Sets whether destructive and billable commands ask for confirmation at a terminal.<br />**Default:** `true` |

> **Notes:**
>
> - **Clients:** The config directory is DAYTONA_CONFIG_DIR when set, else the daytona directory in XDG_CONFIG_HOME, else `~/.config/daytona`.
> - **Confirmation:** Pass --yes or set DAYTONA_YES to `1` to confirm without a prompt, for example in scripts and CI.

## Authenticate API requests

Send the API key as a bearer token in the authorization header of every request. A bearer token grants access to whoever presents it, without any further proof of identity, which is why it is sent only over encrypted connections such as HTTPS.

**API:**

```bash
curl 'https://api.daytona.com/sandboxes' \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  --data '{}'
```
