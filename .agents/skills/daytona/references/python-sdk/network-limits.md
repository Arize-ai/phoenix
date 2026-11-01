## Contents

- Tier-based network restrictions
- Create sandboxes with network restrictions
- Update network settings while a sandbox is running
- Outbound proxy
- Network allow list format
- Domain allow list format
- Test network access
- Security benefits
- Essential services




Network limits control outbound internet access from sandboxes. Each sandbox runs behind a firewall that restricts which external IP addresses and domains it can reach, preventing untrusted code from exfiltrating data or contacting arbitrary hosts.

Default network policies are applied automatically based on your organization's tier. You can also configure access per sandbox using these parameters:

- **`networkAllowList`** for IPv4 CIDR ranges
- **`domainAllowList`** for domains and wildcard domains
- **`networkBlockAll`** to block all outbound traffic
- **`outboundProxyUrl`** to route sandbox HTTP(S) traffic through an upstream proxy

Set firewall parameters when [creating a sandbox](#create-sandboxes-with-network-restrictions) or [update them while the sandbox is running](#update-network-settings-while-a-sandbox-is-running). Set [**`outboundProxyUrl`**](#outbound-proxy) only at create time.

## Tier-based network restrictions

Network limits are automatically applied to sandboxes based on your organization's billing tier. This provides secure and controlled internet access for development environments:

- **Tier 1 & Tier 2**: Network access is restricted and cannot be overridden at the sandbox level. Organization-level network restrictions take precedence over sandbox-level settings. Even with [`networkAllowList`](#create-sandboxes-with-network-restrictions) or [`domainAllowList`](#create-sandboxes-with-network-restrictions) specified when creating a sandbox, the organization's network restrictions still apply. [Essential services](#essential-services) remain reachable.
- **Tier 3 & Tier 4**: Full internet access is available by default, including [essential services](#essential-services). You can set custom network settings per sandbox. A sandbox-level `networkAllowList`, `domainAllowList`, or `networkBlockAll` replaces the default policy for that sandbox. Enforcement is strict: only destinations you list are allowed (or none, when blocking all). Essential services do not bypass a sandbox allow list or block-all setting.

## Create sandboxes with network restrictions

Create a sandbox with network restrictions.

Set `networkAllowList`, `domainAllowList`, or `networkBlockAll` when creating a sandbox to control which external hosts the sandbox can reach. The options are mutually exclusive. Set at most one non-empty value. Sending a conflicting combination returns a `400` error. Empty-string allow lists count as unset and never conflict.

On Tier 3 and Tier 4, setting an allow list or `networkBlockAll` at create time applies that policy for the sandbox. Destinations not on the allow list are blocked, including [essential services](#essential-services) such as GitHub, npm, and PyPI, unless you add those domains or CIDRs yourself.

```python
from daytona import CreateSandboxFromSnapshotParams, Daytona

daytona = Daytona()

# Allow access to specific IP addresses (Wikipedia, X/Twitter, private network)
sandbox = daytona.create(CreateSandboxFromSnapshotParams(
    network_allow_list='208.80.154.232/32,199.16.156.103/32,192.168.1.0/24'
))

# Allow access to specific domains
sandbox = daytona.create(CreateSandboxFromSnapshotParams(
    domain_allow_list='example.com,*.daytona.io'
))

# Or block all network access
sandbox = daytona.create(CreateSandboxFromSnapshotParams(
    network_block_all=True
))
```

## Update network settings while a sandbox is running

Update network settings for running sandboxes.

This operation requires the `WRITE_SANDBOXES` permission. Organizations on [Tier 3 and Tier 4](#tier-based-network-restrictions) can change outbound firewall policy on a running sandbox. The API applies the new rules and persists them on the sandbox. The sandbox keeps running; stop or start are not required.

Organizations on Tier 1 or Tier 2 cannot override network policy at the sandbox level, and the API returns an error in that case.

When an allow list or `networkBlockAll` is applied, enforcement is strict for that sandbox: [essential services](#essential-services) are not auto-allowed.

- Sending `networkAllowList` as an empty string clears a stored CIDR allow list
- Sending `domainAllowList` as an empty string clears a stored domain allow list
- Sending `networkBlockAll: true` blocks all outbound traffic and clears both the stored CIDR and domain allow lists
- Sending only `networkBlockAll: false` removes the block-all rule and clears both the stored CIDR and domain allow lists

```python
# Block all outbound traffic (clears the CIDR allow list)
sandbox.update_network_settings(network_block_all=True)

# Remove the block-all rule and clear the CIDR allow list
sandbox.update_network_settings(network_block_all=False)

# Apply or replace a CIDR allow list (implies not blocking all)
sandbox.update_network_settings(
    network_allow_list='208.80.154.232/32,192.168.1.0/24'
)

# Apply or replace a domain allow list
sandbox.update_network_settings(
    domain_allow_list='example.com,*.daytona.io'
)

# Clear a stored CIDR allow list (empty string). Outbound traffic still follows `network_block_all`.
sandbox.update_network_settings(network_allow_list='')

# Clear a stored domain allow list
sandbox.update_network_settings(domain_allow_list='')
```

## Outbound proxy

Create a sandbox with an outbound proxy.

An outbound proxy sends a sandbox's HTTP(S) egress through a proxy you control. You can set the `outboundProxyUrl` parameter when creating a sandbox to specify the upstream proxy URL Daytona should chain to. Daytona routes matching traffic through its egress proxy to that upstream instead of dialing destinations directly.

1. Daytona stores the proxy URL on the sandbox (encrypted at rest) and sets **`HTTP_PROXY`** (and **`HTTPS_PROXY`**) inside the sandbox.
2. HTTP(S) clients that respect those variables send traffic through Daytona's egress proxy, which chains to your upstream.
3. To prevent clients that do not respect **`HTTP_PROXY`** from bypassing your upstream proxy, also configure Daytona's [**`domainAllowList`**](#domain-allow-list-format).

The URL may use `http` or `https` and may include credentials in the userinfo, for example `http://user:pass@proxy.example.com:3128`. Implement [domain allow listing](#domain-allow-list-format) on your own proxy to control which destinations the sandbox can reach.

| **Constraint** | **Value**                                                                    |
| -------------- | ---------------------------------------------------------------------------- |
| Schemes        | **`http`**, **`https`**                                                      |
| Max length     | **`2048`** characters                                                        |
| Host           | Must not be **`localhost`** or a private, loopback, or link-local IP literal |

```python
from daytona import CreateSandboxFromSnapshotParams, Daytona

daytona = Daytona()

sandbox = daytona.create(CreateSandboxFromSnapshotParams(
    outbound_proxy_url='http://user:pass@proxy.example.com:3128',
))

# Returned on single-sandbox reads
sandbox = daytona.get(sandbox.id)
print(sandbox.outbound_proxy_url)
```

## Network allow list format

The network allow list is a comma-separated list of IPv4 CIDR blocks. When a CIDR allow list is set, outbound traffic is limited to the listed ranges. Other destinations are blocked, including [essential services](#essential-services) whose resolved addresses are not covered by the list.

- **IPv4 only**: hostnames, domains, and IPv6 are not supported
- **CIDR required**: every entry must include a `/` prefix length integer in the range `0` to `32` (inclusive), for example: `/32`
- **CIDR format**: use standard CIDR notation (`A.B.C.D/N`). Do not include extra `/` segments
- **Max 10 entries**: the list cannot contain more than 10 comma-separated items
- **Whitespace is ignored**: entries are trimmed, so spaces around commas are ok

Examples:

- **Single IP**: `208.80.154.232/32` (Wikipedia)
- **Subnet**: `192.168.1.0/24` (Private network)
- **Multiple networks**: `208.80.154.232/32,199.16.156.103/32,10.0.0.0/8`

## Domain allow list format

The domain allow list is a comma-separated list of DNS domains. When a domain allow list is set, outbound traffic is limited to the listed domains. Other external domains are blocked, including [essential services](#essential-services) that are not on the list.

- **Domains only**: use hostnames such as `example.com` or `api.openai.com`. Do not include protocols, paths, ports, or query strings
- **Wildcards supported**: prefix a domain with `*.` to allow the base domain and its subdomains, for example `*.daytona.io`
- **Max 100 entries**: the list cannot contain more than 100 comma-separated items
- **Whitespace is ignored**: entries are trimmed, so spaces around commas are ok
- **Clear on update**: send `domainAllowList` as an empty string when updating network settings to clear a stored domain allow list
- **No essential-services bypass**: GitHub, npm, PyPI, model providers, and other [essential services](#essential-services) are not auto-allowed. Add each domain you need.

Examples:

- **Single domain**: `example.com`
- **Wildcard domain**: `*.daytona.io`
- **Multiple domains**: `example.com,*.daytona.io,api.openai.com`

## Test network access

To test network connectivity from your sandbox:

```bash
# Test HTTP connectivity to allowed addresses
curl -I https://208.80.154.232

# Test HTTP connectivity to allowed domains
curl -I https://example.com

# Package managers reach registries only when those hosts are allowed
# (default tier policy includes essential services; a sandbox allow list does not)
apt update  # For Ubuntu/Debian
npm ping    # For Node.js
pip install --dry-run requests  # For Python
```

## Security benefits

Network limits provide several security advantages:

- **Prevents data exfiltration** from sandboxes
- **Reduces attack surface** by limiting external connections
- **Complies with security policies** for development environments
- **Enables fine-grained control** over network access
> **Caution:**
> Enabling unrestricted network access may pose security risks when executing untrusted code. It is recommended to allow only the network addresses or domains you need, or block all network access. Test network connectivity before starting critical development work and consider upgrading your tier if you need access to many external services.

## Essential services

Essential services are package registries, git hosts, model providers, and related hosts that remain reachable under the default tier-based network policy on all tiers.

They do not apply when a sandbox has a custom `networkAllowList`, `domainAllowList`, or `networkBlockAll` on Tier 3 or Tier 4. In those modes, only the destinations you configure are allowed (or none). To keep an essential service reachable under an allow list, include its domains or CIDRs in that list.

### NPM registry and package managers

| **Service**   | **Domains**                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| NPM Registry  | **`registry.npmjs.org`**, **`registry.npmjs.com`**, **`nodejs.org`**, **`nodesource.com`**, **`deb.nodesource.com`**, **`npm.pkg.github.com`** |
| Yarn Packages | **`yarnpkg.com`**, **`*.yarnpkg.com`**, **`yarn.npmjs.org`**, **`yarnpkg.netlify.com`**                                                        |
| Bun           | **`bun.sh`**, **`*.bun.sh`**                                                                                                                   |

### Nix package manager

| **Service** | **Domains**                                                               |
| ----------- | ------------------------------------------------------------------------- |
| Nix         | **`cache.nixos.org`**, **`channels.nixos.org`**, **`releases.nixos.org`** |

### Git hosting and version control

| **Service**  | **Domains**                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub       | **`github.com`**, **`*.github.com`**, **`*.githubusercontent.com`**, **`gh.io`**, **`ghcr.io`**                                                                                       |
| GitLab       | **`gitlab.com`**, **`*.gitlab.com`**                                                                                                                                                  |
| Bitbucket    | **`bitbucket.org`**                                                                                                                                                                   |
| Code Storage | **`code.storage`**, **`*.code.storage`**                                                                                                                                              |
| Azure DevOps | **`dev.azure.com`**, **`*.dev.azure.com`**, **`login.microsoftonline.com`**, **`visualstudio.com`**, **`*.visualstudio.com`**, **`ssh.dev.azure.com`**, **`vs-ssh.visualstudio.com`** |

### Python package managers

| **Service** | **Domains**                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| PyPI        | **`pypi.org`**, **`pypi.python.org`**, **`files.pythonhosted.org`**, **`bootstrap.pypa.io`**, **`astral.sh`**, **`*.astral.sh`** |
| Conda       | **`repo.anaconda.com`**                                                                                                          |

### Rust package manager and toolchain

| **Service** | **Domains**                                                                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rust        | **`crates.io`**, **`static.crates.io`**, **`index.crates.io`**, **`static.rust-lang.org`**, **`rustup.rs`**, **`sh.rustup.rs`**, **`doc.rust-lang.org`** |

### Go module proxy and toolchain

| **Service** | **Domains**                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| Go          | **`proxy.golang.org`**, **`sum.golang.org`**, **`index.golang.org`**, **`go.dev`**, **`golang.org`**, **`*.golang.org`** |

### C/C++ build tools

| **Service** | **Domains**     |
| ----------- | --------------- |
| CMake       | **`cmake.org`** |

### Composer packages

| **Service** | **Domains**                                                     |
| ----------- | --------------------------------------------------------------- |
| Composer    | **`packagist.org`**, **`*.packagist.org`**, **`packagist.com`** |

### NuGet packages

| **Service** | **Domains**                        |
| ----------- | ---------------------------------- |
| NuGet       | **`nuget.org`**, **`*.nuget.org`** |

### Elixir/Erlang packages

| **Service** | **Domains**                  |
| ----------- | ---------------------------- |
| Hex         | **`hex.pm`**, **`*.hex.pm`** |

### Ruby packages

| **Service** | **Domains**                              |
| ----------- | ---------------------------------------- |
| RubyGems    | **`rubygems.org`**, **`*.rubygems.org`** |

### Ubuntu/Debian package repositories

| **Service**  | **Domains**                                         |
| ------------ | --------------------------------------------------- |
| Ubuntu Repos | **`*.ubuntu.com`**                                  |
| Debian Repos | **`*.debian.org`**, **`cdn-fastly.deb.debian.org`** |

### CDN and content delivery

| **Service**     | **Domains**                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CDN Services    | **`fastly.com`**, **`cloudflare.com`**, **`gateway.ai.cloudflare.com`**, **`*.workers.dev`**, **`r2.cloudflarestorage.com`**, **`*.r2.cloudflarestorage.com`** |
| JavaScript CDNs | **`unpkg.com`**, **`jsdelivr.net`**                                                                                                                            |

### AI/ML services

| **Service**       | **Domains**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anthropic         | **`*.anthropic.com`**, **`claude.ai`**, **`*.claude.ai`**, **`platform.claude.com`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| OpenAI            | **`openai.com`**, **`*.openai.com`**, **`chatgpt.com`**, **`*.chatgpt.com`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Google AI         | **`generativelanguage.googleapis.com`**, **`gemini.google.com`**, **`aistudio.google.com`**, **`ai.google.dev`**, **`models.dev`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Perplexity        | **`api.perplexity.ai`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| DeepSeek          | **`api.deepseek.com`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Groq              | **`api.groq.com`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Expo              | **`api.expo.dev`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| OpenRouter        | **`openrouter.ai`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Qwen              | **`chat.qwen.ai`**, **`dashscope.aliyuncs.com`**, **`dashscope-intl.aliyuncs.com`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Cursor            | **`cursor.com`**, **`*.cursor.com`**, **`*.cursor.sh`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| OpenCode          | **`opencode.ai`**, **`*.opencode.ai`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Aider             | **`aider.chat`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Hugging Face      | **`huggingface.co`**, **`*.huggingface.co`**, **`hf.co`**, **`*.hf.co`**, **`*.xethub.hf.co`**, **`*.cdn.hf.co`**, **`*.aws.cdn.hf.co`**, **`*.gcp.cdn.hf.co`**                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Other AI Services | **`api.letta.com`**, **`api.fireworks.ai`**, **`api.tensorx.ai`**, **`open.bigmodel.cn`**, **`*.z.ai`**, **`*.moonshot.ai`**, **`*.minimax.io`**, **`*.kimi.com`**, **`ai-gateway.vercel.sh`**, **`api.elevenlabs.io`**, **`api.featherless.ai`**, **`ampcode.com`**, **`*.ampcode.com`**, **`*.openai.azure.com`**, **`*.services.ai.azure.com`**, **`trynia.ai`**, **`*.trynia.ai`**, **`api.x.ai`**, **`copass.id`**, **`*.copass.id`**, **`zenmux.ai`**, **`aihubmix.com`**, **`api.aihubmix.com`**, **`*.devin.ai`**, **`*.codeium.com`**, **`you.com`**, **`*.you.com`**, **`ydc-index-.io`** |

### Docker registries and container services

| **Service**                  | **Domains**                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------ |
| Docker Registries            | **`docker.io`**, **`*.docker.io`**, **`*.docker.com`**                         |
| Microsoft Container Registry | **`mcr.microsoft.com`**                                                        |
| Kubernetes Registry          | **`registry.k8s.io`**                                                          |
| Google Container Registry    | **`gcr.io`**, **`*.gcr.io`**, **`*.pkg.dev`**, **`registry.cloud.google.com`** |
| Quay                         | **`quay.io`**, **`quay-registry.s3.amazonaws.com`**                            |
| AWS ECR                      | **`public.ecr.aws`**, **`*.ecr.aws`**                                          |

### Maven repositories

| **Service** | **Domains**                                        |
| ----------- | -------------------------------------------------- |
| Maven Repos | **`repo1.maven.org`**, **`repo.maven.apache.org`** |

### Google Fonts

| **Service**  | **Domains**                                         |
| ------------ | --------------------------------------------------- |
| Google Fonts | **`fonts.googleapis.com`**, **`fonts.gstatic.com`** |

### AWS endpoints

| **Region**   | **Domains**                                                                                                                                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US East      | **`*.us-east-1.amazonaws.com`**, **`*.us-east-2.amazonaws.com`**                                                                                                                                                                                                                |
| US West      | **`*.us-west-1.amazonaws.com`**, **`*.us-west-2.amazonaws.com`**                                                                                                                                                                                                                |
| EU           | **`*.eu-central-1.amazonaws.com`**, **`*.eu-central-2.amazonaws.com`**, **`*.eu-north-1.amazonaws.com`**, **`*.eu-south-1.amazonaws.com`**, **`*.eu-south-2.amazonaws.com`**, **`*.eu-west-1.amazonaws.com`**, **`*.eu-west-2.amazonaws.com`**, **`*.eu-west-3.amazonaws.com`** |
| Asia Pacific | **`*.ap-south-1.amazonaws.com`**                                                                                                                                                                                                                                                |

### Google Cloud

| **Service**             | **Domains**                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| Google Cloud Platform   | **`accounts.google.com`**, **`*.googleapis.com`**, **`*.storage.googleapis.com`**, **`*.gstatic.com`** |
| Google Downloads        | **`dl.google.com`**                                                                                    |
| Google Package Registry | **`packages.cloud.google.com`**                                                                        |

### Cloud storage

| **Service**        | **Domains**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Azure Blob Storage | **`*.blob.core.windows.net`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Box                | **`api.box.com`**, **`app.box.com`**, **`*.app.box.com`**, **`upload.box.com`**, **`account.box.com`**, **`*.ent.box.com`**, **`*.boxcloud.com`**                                                                                                                                                                                                                                                                                                                                                                                              |
| Mountpoint for S3  | **`s3.amazonaws.com`**, **`*.s3.amazonaws.com`**, **`*.s3.us-east-1.amazonaws.com`**, **`*.s3.us-east-2.amazonaws.com`**, **`*.s3.us-west-1.amazonaws.com`**, **`*.s3.us-west-2.amazonaws.com`**, **`*.s3.eu-central-1.amazonaws.com`**, **`*.s3.eu-central-2.amazonaws.com`**, **`*.s3.eu-north-1.amazonaws.com`**, **`*.s3.eu-south-1.amazonaws.com`**, **`*.s3.eu-south-2.amazonaws.com`**, **`*.s3.eu-west-1.amazonaws.com`**, **`*.s3.eu-west-2.amazonaws.com`**, **`*.s3.eu-west-3.amazonaws.com`**, **`*.s3.ap-south-1.amazonaws.com`** |
| Tigris             | **`t3.storage.dev`**, **`*.t3.storage.dev`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Archil             | **`archil.com`**, **`*.archil.com`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| rclone             | **`rclone.org`**, **`downloads.rclone.org`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Microsoft Packages | **`packages.microsoft.com`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

### Daytona

| **Service** | **Domains**          |
| ----------- | -------------------- |
| Daytona     | **`app.daytona.io`** |

### Developer tools and services

| **Service** | **Domains**                                                                                                                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Convex      | **`convex.dev`**, **`*.convex.dev`**, **`*.convex.cloud`**, **`*.convex.site`**                                                                                                                 |
| Heroku      | **`herokuapp.com`**, **`*.herokuapp.com`**                                                                                                                                                      |
| Vercel      | **`vercel.com`**, **`*.vercel.com`**, **`*.vercel.app`**                                                                                                                                        |
| Supabase    | **`supabase.com`**, **`*.supabase.com`**, **`supabase.co`**, **`*.supabase.co`**, **`*.storage.supabase.co`**                                                                                   |
| Clerk       | **`clerk.com`**, **`*.clerk.com`**, **`clerk.dev`**, **`*.clerk.dev`**, **`accounts.dev`**, **`*.accounts.dev`**, **`clerk.accounts.dev`**, **`*.clerk.accounts.dev`**                          |
| WorkOS      | **`workos.com`**, **`*.workos.com`**, **`authkit.app`**, **`*.authkit.app`**                                                                                                                    |
| Inngest     | **`inngest.com`**, **`*.inngest.com`**                                                                                                                                                          |
| PostHog     | **`posthog.com`**, **`*.posthog.com`**                                                                                                                                                          |
| Sentry      | **`sentry.io`**, **`*.sentry.io`**, **`sentry-cdn.com`**, **`*.sentry-cdn.com`**                                                                                                                |
| Linear      | **`linear.app`**, **`*.linear.app`**                                                                                                                                                            |
| Figma       | **`figma.com`**, **`*.figma.com`**, **`*.figmafiles.com`**                                                                                                                                      |
| ClickUp     | **`clickup.com`**, **`*.clickup.com`**                                                                                                                                                          |
| Atlassian   | **`acli.atlassian.com`**                                                                                                                                                                        |
| Railway     | **`railway.app`**, **`*.railway.app`**, **`railway.com`**, **`*.railway.com`**                                                                                                                  |
| Autumn      | **`api.useautumn.com`**                                                                                                                                                                         |
| Playwright  | **`playwright.dev`**, **`cdn.playwright.dev`**                                                                                                                                                  |
| Doppler     | **`doppler.com`**, **`*.doppler.com`**                                                                                                                                                          |
| Auth0       | **`auth0.com`**, **`*.auth0.com`**                                                                                                                                                              |
| Sanity      | **`*.sanity.io`**, **`*.sanity.work`**, **`sanity.io`**, **`sanity.work`**                                                                                                                      |
| Shopify     | **`shopify.com`**, **`*.shopify.com`**, **`*.myshopify.com`**, **`*.shopify.dev`**, **`*.shopifycdn.com`**                                                                                      |
| Mesa        | **`mesa.dev`**, **`*.mesa.dev`**                                                                                                                                                                |
| Buildkite   | **`buildkite.com`**, **`*.buildkite.com`**                                                                                                                                                      |
| Shortcut    | **`api.app.shortcut.com`**, **`app.shortcut.com`**                                                                                                                                              |
| USAspending | **`api.usaspending.gov`**, **`files.usaspending.gov`**                                                                                                                                          |
| Logo Dev    | **`img.logo.dev`**, **`logo.dev`**                                                                                                                                                              |
| Kiro        | **`*.kiro.dev`**, **`*.us-east-1.kiro.dev`**, **`prod.download.cli.kiro.dev`**                                                                                                                  |
| Browserbase | **`browserbase.com`**, **`*.browserbase.com`**, **`connect.usw2.browserbase.com`**, **`connect.use1.browserbase.com`**, **`connect.euc1.browserbase.com`**, **`connect.apse1.browserbase.com`** |

### Messaging services

| **Service** | **Domains**                                  |
| ----------- | -------------------------------------------- |
| Telegram    | **`api.telegram.org`**                       |
| WhatsApp    | **`web.whatsapp.com`**, **`*.whatsapp.net`** |

### LLM observability

| **Service** | **Domains**                                      |
| ----------- | ------------------------------------------------ |
| Langfuse    | **`*.langfuse.com`**, **`*.cloud.langfuse.com`** |
| LangSmith   | **`api.smith.langchain.com`**                    |

### Scientific and ML downloads

| **Service** | **Domains**                            |
| ----------- | -------------------------------------- |
| PyTorch     | **`pytorch.org`**, **`*.pytorch.org`** |
| POV-Ray     | **`povray.org`**, **`*.povray.org`**   |
| RCSB        | **`rcsb.org`**, **`*.rcsb.org`**       |
| PubChem     | **`pubchem.ncbi.nlm.nih.gov`**         |
| FPBase      | **`fpbase.org`**, **`*.fpbase.org`**   |
