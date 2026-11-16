## Contents

- Get an API key
- Environment variables
- Authenticate the SDK
- Authenticate the CLI
- Authenticate API requests
- JWT tokens
- See Also




Daytona authenticates SDK, CLI, and API requests with an [API key](../platform/api-keys.md). The key identifies the organization that owns the resources a request touches and carries the [permissions](../platform/api-keys.md#permissions--scopes) the request may use. Every request sends the key as a bearer token.

A [JWT token](#jwt-tokens) from the CLI login is the alternative for account-level operations. A JWT token identifies a user instead of an organization, so every JWT-authenticated request also names the organization it acts on.

| **Term**              | **Description**                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| **API key**           | A long-lived credential scoped to one organization and a set of permissions. Created in the dashboard. |
| **JWT token**         | A short-lived access token issued when you log in to the CLI. Identifies a user, not an organization. |
| **Organization ID**   | The organization a JWT-authenticated request acts on. Sent in the organization header.               |
| **Target**            | The default region for sandboxes and snapshots a client creates. A per-call target overrides it.     |
| **Profile**           | The CLI's saved login: API URL plus an API key or a JWT token. The active profile serves CLI commands. |

## Get an API key

Create an API key in the dashboard and store it where the SDKs and CLI can read it. See [API keys](../platform/api-keys.md) for permissions, expiration, and key management.

1. Go to [Daytona Dashboard ↗](https://app.daytona.io/dashboard/keys)
2. Click <Button>Create Key</Button>
3. Enter the name of the API key, set the expiration date, and [select permissions](../platform/api-keys.md#permissions--scopes)
4. Click <Button>Create</Button>
5. Copy the API key and save it as an environment variable

## Environment variables

The SDKs and the CLI read their configuration from environment variables. The SDKs resolve each value in order of precedence:

1. Configuration in code
2. Environment variables of the process
3. **`.env.local`** and **`.env`** files in the working directory (Python, TypeScript, and Ruby)
4. Default values

The API URL is the exception: the SDKs read it from code or from the process environment only. A `DAYTONA_API_URL` value in a `.env` file is ignored and reported, so a file in the working directory cannot redirect your API key to another endpoint.

| **Variable**                  | **Description**                                                                                     |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| **`DAYTONA_API_KEY`**         | Your Daytona API key. <br /> Required unless a JWT token is set.                                    |
| **`DAYTONA_API_URL`**         | URL of the Daytona API. <br /> Default: **`https://app.daytona.io/api`**                            |
| **`DAYTONA_TARGET`**          | Default [region](./regions.md) for sandboxes and snapshots. <br /> Optional.                    |
| **`DAYTONA_JWT_TOKEN`**       | JWT token from **`daytona login`**. <br /> Alternative to the API key.                              |
| **`DAYTONA_ORGANIZATION_ID`** | Your organization ID. <br /> Required when authenticating with a JWT token.                         |

### .env file

```bash
DAYTONA_API_KEY=YOUR_API_KEY
DAYTONA_API_URL=https://app.daytona.io/api
DAYTONA_TARGET=us
```

### Shell

**Bash/Zsh:**

```bash
export DAYTONA_API_KEY=YOUR_API_KEY
export DAYTONA_API_URL=https://app.daytona.io/api
export DAYTONA_TARGET=us
```

**Windows PowerShell:**

```powershell
$env:DAYTONA_API_KEY="YOUR_API_KEY"
$env:DAYTONA_API_URL="https://app.daytona.io/api"
$env:DAYTONA_TARGET="us"
```

## Authenticate the SDK

Construct the client without arguments to read the environment variables, or pass the configuration in code. Each configuration field falls back to its environment variable on its own, so you can set the API key in code and the target in the environment. When no API key and no JWT token is found, the constructor raises an authentication error.

```ruby
require 'daytona'

# Using environment variables
daytona = Daytona::Daytona.new

# Using explicit configuration
config = Daytona::Config.new(
  api_key: 'YOUR_API_KEY',
  api_url: 'https://app.daytona.io/api',
  target: 'us'
)

daytona = Daytona::Daytona.new(config)
```

## Authenticate the CLI

Log in once and the CLI saves the result in its active profile, so later commands need no key or flags. The login prompt offers two methods: a browser login, which stores a JWT token, or an API key, which stores the key. Pass the key as a flag to skip the prompt.

When both `DAYTONA_API_KEY` and `DAYTONA_API_URL` are set in the environment, the CLI uses them instead of the active profile for that command.

**CLI:**

```bash
# Interactive login: choose browser login or enter an API key
daytona login

# Store an API key in the active profile without the prompt
daytona login --api-key YOUR_API_KEY

# Use the saved profile
daytona sandbox list

# Remove the saved profile from this machine
daytona logout
```

## Authenticate API requests

Send the API key as a bearer token in the authorization header of every request.

**API:**

```bash
curl 'https://app.daytona.io/api/sandbox' \
  --request GET \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

## JWT tokens

JWT tokens authenticate account-level operations with the Daytona API. A JWT token identifies a user, so every JWT-authenticated request must include the `X-Daytona-Organization-ID` header set to the organization it acts on. JWT tokens expire after a short period. The Python, TypeScript, Ruby, and Go SDKs accept a JWT token and an organization ID in place of an API key. The Java SDK accepts API keys only.

1. Run [**`daytona login`**](../cli.md#daytona-login)
2. Select <Button>Login with Browser</Button>
3. Complete the sign-in in your browser
4. The CLI saves the access token to `config.json` in the Daytona config directory

Daytona resolves the config directory from the `$DAYTONA_CONFIG_DIR` environment variable. If the variable is not set, Daytona uses the `daytona` folder inside your OS user config directory: `~/.config/daytona` on Linux and `~/Library/Application Support/daytona` on macOS. The active profile stores the token in the `api.token.accessToken` field.

```ruby
require 'daytona'

# Using environment variables: DAYTONA_JWT_TOKEN and DAYTONA_ORGANIZATION_ID
daytona = Daytona::Daytona.new

# Using explicit configuration
config = Daytona::Config.new(
  jwt_token: 'YOUR_JWT_TOKEN',
  organization_id: 'YOUR_ORGANIZATION_ID'
)

daytona = Daytona::Daytona.new(config)
```

## See Also
- [Python SDK - authentication](../python-sdk/authentication.md)
- [TypeScript SDK - authentication](../typescript-sdk/authentication.md)
- [Java SDK - authentication](../java-sdk/authentication.md)
- [Go SDK - authentication](../go-sdk/authentication.md)
