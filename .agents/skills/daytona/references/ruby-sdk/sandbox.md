
## Sandbox

Internal — obtain sandboxes via Daytona::Daytona#create, Daytona::Daytona#get,
or Daytona::Daytona#list rather than constructing directly.

### Constructors

#### new Sandbox()

```ruby
def initialize(sandbox_dto:, config:, sandbox_api:, subscription_manager:, otel_state: nil, analytics_api_url_provider: nil)

```

Internal — obtain sandboxes via Daytona::Daytona#create, Daytona::Daytona#get,
or Daytona::Daytona#list rather than constructing directly.

**Returns**:

- `Sandbox` - a new instance of Sandbox

### Methods

#### id()

```ruby
def id()

```

**Returns**:

- `String` - The ID of the sandbox

#### organization_id()

```ruby
def organization_id()

```

**Returns**:

- `String` - The organization ID of the sandbox

#### snapshot()

```ruby
def snapshot()

```

**Returns**:

- `String` - The snapshot used for the sandbox

#### user()

```ruby
def user()

```

**Returns**:

- `String` - The user associated with the project

#### env()

```ruby
def env()

```

**Returns**:

- `Hash\<String, String\>, nil` - Environment variables for the sandbox.
Not returned by list results; call #refresh on each item to populate.

#### labels()

```ruby
def labels()

```

**Returns**:

- `Hash\<String, String\>` - Labels for the sandbox

#### public()

```ruby
def public()

```

**Returns**:

- `Boolean` - Whether the sandbox http preview is public

#### network_block_all()

```ruby
def network_block_all()

```

**Returns**:

- `Boolean, nil` - Whether to block all network access for the sandbox.
Not returned by list results; call #refresh on each item to populate.

#### network_allow_list()

```ruby
def network_allow_list()

```

**Returns**:

- `String, nil` - Comma-separated list of allowed CIDR network addresses for the sandbox.
Not returned by list results; call #refresh on each item to populate.

#### domain_allow_list()

```ruby
def domain_allow_list()

```

**Returns**:

- `String, nil` - Comma-separated list of allowed domains for the sandbox.
Not returned by list results; call #refresh on each item to populate.

#### outbound_proxy_url()

```ruby
def outbound_proxy_url()

```

**Returns**:

- `String, nil` - Outbound proxy URL to route the sandbox HTTP(S) traffic through.
Not returned by list results; call #refresh on each item to populate.

#### otel_endpoint_override()

```ruby
def otel_endpoint_override()

```

**Returns**:

- `String, nil` - OpenTelemetry endpoint override for the sandbox.
Not returned by list results; call #refresh on each item to populate.

#### target()

```ruby
def target()

```

**Returns**:

- `String` - The target environment for the sandbox

#### cpu()

```ruby
def cpu()

```

**Returns**:

- `Float` - The CPU quota for the sandbox

#### gpu()

```ruby
def gpu()

```

**Returns**:

- `Float` - The GPU quota for the sandbox

#### spot()

```ruby
def spot()

```

**Returns**:

- `Boolean` - Whether this is a spot GPU sandbox. Spot sandboxes may be instantly terminated
to free capacity for on-demand GPU sandboxes.

#### spot_evicted_at()

```ruby
def spot_evicted_at()

```

**Returns**:

- `String, nil` - When the sandbox was evicted by spot preemption

#### gpu_type()

```ruby
def gpu_type()

```

**Returns**:

- `String, nil` - The GPU type assigned to the sandbox

#### memory()

```ruby
def memory()

```

**Returns**:

- `Float` - The memory quota for the sandbox

#### disk()

```ruby
def disk()

```

**Returns**:

- `Float` - The disk quota for the sandbox

#### state()

```ruby
def state()

```

**Returns**:

- `DaytonaApiClient:SandboxState` - The state of the sandbox

#### desired_state()

```ruby
def desired_state()

```

**Returns**:

- `DaytonaApiClient:SandboxDesiredState` - The desired state of the sandbox

#### error_reason()

```ruby
def error_reason()

```

**Returns**:

- `String` - The error reason of the sandbox

#### backup_state()

```ruby
def backup_state()

```

**Returns**:

- `String` - The state of the backup

#### backup_created_at()

```ruby
def backup_created_at()

```

**Returns**:

- `String, nil` - The creation timestamp of the last backup.
Not returned by list results; call #refresh on each item to populate.

#### auto_stop_interval()

```ruby
def auto_stop_interval()

```

**Returns**:

- `Float` - Auto-stop interval in minutes (0 means disabled)

#### auto_pause_interval()

```ruby
def auto_pause_interval()

```

**Returns**:

- `Float` - Auto-pause interval in minutes (0 means disabled)

#### auto_archive_interval()

```ruby
def auto_archive_interval()

```

**Returns**:

- `Float` - Auto-archive interval in minutes

#### auto_delete_interval()

```ruby
def auto_delete_interval()

```

(negative value means disabled, 0 means delete immediately upon stopping)

**Returns**:

- `Float` - Auto-delete interval in minutes

#### volumes()

```ruby
def volumes()

```

**Returns**:

- `Array\<DaytonaApiClient:SandboxVolume\>, nil` - Volumes attached to the sandbox.
Not returned by list results; call #refresh on each item to populate.

#### build_info()

```ruby
def build_info()

```

**Returns**:

- `DaytonaApiClient:BuildInfo, nil` - Build information for the sandbox if it was
created from a dynamic build.
Not returned by list results; call #refresh on each item to populate.

#### auto_destroy_at()

```ruby
def auto_destroy_at()

```

**Returns**:

- `String, nil` - When the sandbox will be automatically destroyed (nil if no TTL is set)

#### created_at()

```ruby
def created_at()

```

**Returns**:

- `String` - The creation timestamp of the sandbox

#### updated_at()

```ruby
def updated_at()

```

**Returns**:

- `String` - The last update timestamp of the sandbox

#### last_activity_at()

```ruby
def last_activity_at()

```

**Returns**:

- `String` - The last activity timestamp of the sandbox

#### sandbox_class()

```ruby
def sandbox_class()

```

**Returns**:

- `String, nil` - The class of the sandbox (e.g. "linux-vm", "container")

#### warm_pool_id()

```ruby
def warm_pool_id()

```

**Returns**:

- `String, nil` - ID of the warm pool this sandbox waits in; set only while it is an unclaimed member

#### daemon_version()

```ruby
def daemon_version()

```

**Returns**:

- `String` - The version of the daemon running in the sandbox

#### toolbox_proxy_url()

```ruby
def toolbox_proxy_url()

```

**Returns**:

- `String` - The toolbox proxy URL used to reach the sandbox's toolbox API

#### config()

```ruby
def config()

```

**Returns**:

- `Daytona:Config`

#### sandbox_api()

```ruby
def sandbox_api()

```

**Returns**:

- `DaytonaApiClient:SandboxApi`

#### process()

```ruby
def process()

```

**Returns**:

- `Daytona:Process`

#### fs()

```ruby
def fs()

```

**Returns**:

- `Daytona:FileSystem`

#### git()

```ruby
def git()

```

**Returns**:

- `Daytona:Git`

#### computer_use()

```ruby
def computer_use()

```

**Returns**:

- `Daytona:ComputerUse`

#### code_interpreter()

```ruby
def code_interpreter()

```

**Returns**:

- `Daytona:CodeInterpreter`

#### archive()

```ruby
def archive()

```

Archives the sandbox, making it inactive and preserving its state. When sandboxes are
archived, the entire filesystem state is moved to cost-effective object storage, making it
possible to keep sandboxes available for an extended period. The tradeoff between archived
and stopped states is that starting an archived sandbox takes more time, depending on its size.
Sandbox must be stopped before archiving.

**Returns**:

- `void`

#### auto_archive_interval=()

```ruby
def auto_archive_interval=(interval)

```

Sets the auto-archive interval for the Sandbox.
The Sandbox will automatically archive after being continuously stopped for the specified interval.

**Parameters**:

- `interval` _Integer_ -

**Returns**:

- `Integer`

**Raises**:

- `Daytona:Sdk:Error` -

#### auto_delete_interval=()

```ruby
def auto_delete_interval=(interval)

```

Sets the auto-delete interval for the Sandbox.
The Sandbox will automatically delete after being continuously stopped for the specified interval.

**Parameters**:

- `interval` _Integer_ -

**Returns**:

- `Integer`

**Raises**:

- `Daytona:Sdk:Error` -

#### update_network_settings()

```ruby
def update_network_settings(network_block_all: nil, network_allow_list: nil, domain_allow_list: nil)

```

Updates outbound network policy on the runner (block all, restore access, or CIDR allow list).

**Parameters**:

- `network_block_all` _Boolean, nil_ -
- `network_allow_list` _String, nil_ -
- `domain_allow_list` _String, nil_ -

**Returns**:

- `void`

**Raises**:

- `Daytona:Sdk:Error` -

#### update_secrets()

```ruby
def update_secrets(secrets)

```

Replaces the set of organization vault secrets mounted in the Sandbox. Pass an empty
hash to detach all secrets. Rotated, attached or detached secrets take effect for
outbound requests within seconds. New environment variables are only visible to
processes spawned after the update; a Sandbox created without any secrets must be
restarted for newly attached secrets to work.

**Parameters**:

- `secrets` _Hash\<String, String\>_ - Mapping of environment variable name to
organization vault secret name

**Returns**:

- `void`

**Raises**:

- `Daytona:Sdk:Error` -

**Examples:**

```ruby
sandbox.update_secrets({ 'API_KEY' => 'my-vault-secret' })

```

#### auto_stop_interval=()

```ruby
def auto_stop_interval=(interval)

```

Sets the auto-stop interval for the Sandbox.
The Sandbox will automatically stop after being idle (no new events) for the specified interval.
Events include any state changes or interactions with the Sandbox through the SDK.
Interactions using Sandbox Previews are not included.

**Parameters**:

- `interval` _Integer_ -

**Returns**:

- `Integer`

**Raises**:

- `Daytona:Sdk:Error` -

#### auto_pause_interval=()

```ruby
def auto_pause_interval=(interval)

```

Sets the auto-pause interval for the Sandbox.
The Sandbox will automatically pause after being idle (no new events) for the specified interval.
Events include any state changes or interactions with the Sandbox through the SDK.
Interactions using Sandbox Previews are not included.

**Parameters**:

- `interval` _Integer_ -

**Returns**:

- `Integer`

**Raises**:

- `Daytona:Sdk:Error` -

#### ttl_minutes=()

```ruby
def ttl_minutes=(minutes)

```

Sets the TTL (time to live) for the Sandbox.
The TTL is re-anchored from the current time. When it elapses the Sandbox is destroyed,
regardless of its current state. Use 0 to disable.

**Parameters**:

- `minutes` _Integer_ -

**Returns**:

- `void`

**Raises**:

- `Daytona:Sdk:Error` -

#### create_ssh_access()

```ruby
def create_ssh_access(expires_in_minutes)

```

Creates an SSH access token for the sandbox.

**Parameters**:

- `expires_in_minutes` _Integer_ - TThe number of minutes the SSH access token will be valid for

**Returns**:

- `DaytonaApiClient:SshAccessDto`

#### delete()

```ruby
def delete(timeout = DEFAULT_TIMEOUT, wait: false)

```

Deletes the Sandbox.

By default returns as soon as the deletion request is accepted (matching
origin/main behavior). Pass +wait: true+ to block until the Sandbox
reaches the +destroyed+ state.

**Parameters**:

- `timeout` _Numeric_ - Maximum wait time in seconds (defaults to 60 s).
Only meaningful when +wait+ is true.
- `wait` _Boolean_ - When +true+, block until the Sandbox is destroyed.

**Returns**:

- `void`

#### get_user_home_dir()

```ruby
def get_user_home_dir()

```

Gets the user's home directory path for the logged in user inside the Sandbox.

**Returns**:

- `String` - The absolute path to the Sandbox user's home directory for the logged in user

**Examples:**

```ruby
user_home_dir = sandbox.get_user_home_dir
puts "Sandbox user home: #{user_home_dir}"

```

#### get_work_dir()

```ruby
def get_work_dir()

```

Gets the working directory path inside the Sandbox.

**Returns**:

- `String` - The absolute path to the Sandbox working directory. Uses the WORKDIR specified
in the Dockerfile if present, or falling back to the user's home directory if not.

**Examples:**

```ruby
work_dir = sandbox.get_work_dir
puts "Sandbox working directory: #{work_dir}"

```

#### update_env()

```ruby
def update_env(env: nil, unset: nil)

```

Updates the Sandbox daemon's process environment. Newly spawned processes, sessions
and PTYs inherit the change; already-running processes keep their existing environment.

**Parameters**:

- `env` _Hash\<String, String\>, nil_ - Env vars to set in the daemon's process environment
- `unset` _Array\<String\>, nil_ - Environment variable names to remove

**Returns**:

- `void`

**Raises**:

- `Daytona:Sdk:Error` -

**Examples:**

```ruby
sandbox.update_env(env: { 'FOO' => 'bar' }, unset: ['OLD_VAR'])

```

#### get_metrics_latest()

```ruby
def get_metrics_latest()

```

Gets the most recent resource usage sample directly from the Sandbox daemon.

Unlike #get_metrics, which returns aggregated historical samples, this returns the
single current reading without going through the telemetry backend.

**Returns**:

- `Daytona:SandboxMetrics`

**Examples:**

```ruby
m = sandbox.get_metrics_latest
puts "CPU used: #{m.cpu_used_pct}%"

```

#### get_metrics()

```ruby
def get_metrics(start_time = nil, end_time = nil)

```

Gets historical time-series resource usage metrics for the Sandbox.

**Parameters**:

- `start_time` _Time, nil_ - Start of the range. Defaults to the Sandbox creation time.
- `end_time` _Time, nil_ - End of the range. Defaults to the current time.

**Returns**:

- `Array\<Daytona:SandboxMetrics\>` - Time-ordered usage samples.

**Examples:**

```ruby
sandbox.get_metrics.each { |m| puts "#{m.timestamp}: #{m.cpu_used_pct}%" }

```

#### labels=()

```ruby
def labels=(labels)

```

Sets labels for the Sandbox.

**Parameters**:

- `labels` _Hash\<String, String\>_ -

**Returns**:

- `Hash\<String, String\>`

#### preview_url()

```ruby
def preview_url(port)

```

Retrieves the preview link for the sandbox at the specified port. If the port is closed,
it will be opened automatically. For private sandboxes, a token is included to grant access
to the URL.

**Parameters**:

- `port` _Integer_ -

**Returns**:

- `DaytonaApiClient:PortPreviewUrl`

#### download_url()

```ruby
def download_url(path, ttl_seconds: nil)

```

Creates a pre-signed URL for downloading a file from the Sandbox.

The URL works with any HTTP client without auth headers and stays valid across
sandbox restarts (downloads succeed only while the sandbox is running). The signing
key is cached locally for up to 15 seconds; if the key was rotated from another
client, URLs may be rejected until the cache refreshes.

**Parameters**:

- `path` _String_ - Path to the file in the Sandbox.
- `ttl_seconds` _Integer, nil_ - How long the URL stays valid, in seconds.
Defaults to 3600. Zero or negative means the URL never expires.

**Returns**:

- `String` - Pre-signed download URL.

**Raises**:

- `Daytona:Sdk:Error` - if the signing key cannot be fetched.

**Examples:**

```ruby
url = sandbox.download_url('/home/user/report.pdf')
# curl "$url" -o report.pdf

```

#### upload_url()

```ruby
def upload_url(path, ttl_seconds: nil)

```

Creates a pre-signed URL for uploading a file to the Sandbox.

Send a POST request with the file as multipart/form-data. The URL works with any
HTTP client without auth headers. The signing key is cached locally for up to
15 seconds; if the key was rotated from another client, URLs may be rejected
until the cache refreshes.

**Parameters**:

- `path` _String_ - Destination path for the uploaded file in the Sandbox.
- `ttl_seconds` _Integer, nil_ - How long the URL stays valid, in seconds.
Defaults to 3600. Zero or negative means the URL never expires.

**Returns**:

- `String` - Pre-signed upload URL.

**Raises**:

- `Daytona:Sdk:Error` - if the signing key cannot be fetched.

**Examples:**

```ruby
url = sandbox.upload_url('/home/user/data.bin')
# curl -X POST -F "file=@local.bin" "$url"

```

#### rotate_signing_key()

```ruby
def rotate_signing_key()

```

Rotates the sandbox signing key, invalidating all previously signed URLs.

**Returns**:

- `void`

**Raises**:

- `DaytonaApiClient:ApiError` - if the signing key rotation request fails.

**Examples:**

```ruby
sandbox.rotate_signing_key
puts 'All previously signed URLs are now invalid.'

```

#### create_signed_preview_url()

```ruby
def create_signed_preview_url(port, expires_in_seconds = nil)

```

Creates a signed preview URL for the sandbox at the specified port.

**Parameters**:

- `port` _Integer_ - The port to open the preview link on
- `expires_in_seconds` _Integer, nil_ - The number of seconds the signed preview URL
will be valid for. Defaults to 60 seconds.

**Returns**:

- `DaytonaApiClient:SignedPortPreviewUrl` - The signed preview URL response object

**Examples:**

```ruby
signed_url = sandbox.create_signed_preview_url(3000, 120)
puts "Signed URL: #{signed_url.url}"
puts "Token: #{signed_url.token}"

```

#### expire_signed_preview_url()

```ruby
def expire_signed_preview_url(port, token)

```

Expires a signed preview URL for the sandbox at the specified port.

**Parameters**:

- `port` _Integer_ - The port to expire the signed preview URL on
- `token` _String_ - The token to expire

**Returns**:

- `void`

**Examples:**

```ruby
sandbox.expire_signed_preview_url(3000, "token-value")

```

#### refresh()

```ruby
def refresh()

```

Refresh the Sandbox data from the API.

**Returns**:

- `void`

#### refresh_activity()

```ruby
def refresh_activity()

```

Refreshes the sandbox activity to reset the timer for automated lifecycle management actions.

This method updates the sandbox's last activity timestamp without changing its state.
It is useful for keeping long-running sessions alive while there is still user activity.

**Returns**:

- `void`

**Examples:**

```ruby
sandbox.refresh_activity

```

#### revoke_ssh_access()

```ruby
def revoke_ssh_access(token)

```

Revokes an SSH access token for the sandbox.

**Parameters**:

- `token` _String_ -

**Returns**:

- `void`

#### start()

```ruby
def start(timeout = DEFAULT_TIMEOUT)

```

Starts the Sandbox and waits for it to be ready.

**Parameters**:

- `timeout` _Numeric_ - Maximum wait time in seconds (defaults to 60 s).

**Returns**:

- `void`

#### recover()

```ruby
def recover(timeout = DEFAULT_TIMEOUT)

```

Recovers the Sandbox from a recoverable error and waits for it to be ready.

**Parameters**:

- `timeout` _Numeric_ - Maximum wait time in seconds (defaults to 60 s).

**Returns**:

- `void`

**Examples:**

```ruby
sandbox = daytona.get('my-sandbox-id')
sandbox.recover(timeout: 40)  # Wait up to 40 seconds
puts 'Sandbox recovered successfully'

```

#### stop()

```ruby
def stop(timeout = DEFAULT_TIMEOUT, force: false)

```

Stops the Sandbox and waits for it to be stopped.

**Parameters**:

- `timeout` _Numeric_ - Maximum wait time in seconds (defaults to 60 s).
- `force` _Boolean_ - If true, uses SIGKILL instead of SIGTERM (defaults to false).

**Returns**:

- `void`

#### resize()

```ruby
def resize(resources, timeout = DEFAULT_TIMEOUT)

```

Resizes the Sandbox resources.

Changes the CPU, memory, or disk allocation. Resizing a started sandbox accepts
only CPU and memory increases. Disk resize requires a stopped sandbox; disk can
only grow. GPU is not resizable — to change GPU, create a new sandbox.

**Parameters**:

- `resources` _Daytona:Resources_ - New resource configuration (cpu, memory, disk only)
- `timeout` _Numeric_ - Maximum wait time in seconds (defaults to 60 s)

**Returns**:

- `void`

**Raises**:

- `Sdk:Error` - If resources.gpu or resources.gpu_type is set

**Examples:**

```ruby
sandbox.resize(Daytona::Resources.new(cpu: 4, memory: 8))

```

```ruby
sandbox.stop
sandbox.resize(Daytona::Resources.new(cpu: 2, memory: 4, disk: 30))

```

#### wait_for_resize_complete()

```ruby
def wait_for_resize_complete(timeout = DEFAULT_TIMEOUT)

```

Waits for the Sandbox resize operation to complete.
Polls the Sandbox status until the state is no longer 'resizing'.

**Parameters**:

- `timeout` _Numeric_ - Maximum wait time in seconds (defaults to 60 s)

**Returns**:

- `void`

#### create_lsp_server()

```ruby
def create_lsp_server(language_id:, path_to_project:)

```

Creates a new Language Server Protocol (LSP) server instance.
The LSP server provides language-specific features like code completion,
diagnostics, and more.

**Parameters**:

- `language_id` _Symbol_ - The language server type (e.g., Daytona::LspServer::Language::PYTHON)
- `path_to_project` _String_ - Path to the project root directory. Relative paths are resolved
based on the sandbox working directory.

**Returns**:

- `Daytona:LspServer`

#### validate_ssh_access()

```ruby
def validate_ssh_access(token)

```

Validates an SSH access token for the sandbox.

**Parameters**:

- `token` _String_ -

**Returns**:

- `DaytonaApiClient:SshAccessValidationDto`

#### wait_for_sandbox_start()

```ruby
def wait_for_sandbox_start(timeout = DEFAULT_TIMEOUT)

```

Waits for the Sandbox to reach the 'started' state. Polls the Sandbox status until it
reaches the 'started' state or encounters an error.

**Parameters**:

- `timeout` _Numeric_ - Maximum wait time in seconds (defaults to 60 s).

**Returns**:

- `void`

#### wait_for_sandbox_stop()

```ruby
def wait_for_sandbox_stop(timeout = DEFAULT_TIMEOUT)

```

Waits for the Sandbox to reach the 'stopped' state. Polls the Sandbox status until it
reaches the 'stopped' state or encounters an error.
Treats destroyed as stopped to cover ephemeral sandboxes that are automatically deleted after stopping.

**Parameters**:

- `timeout` _Numeric_ - Maximum wait time in seconds (defaults to 60 s).

**Returns**:

- `void`

#### fork()

```ruby
def fork(name: nil, timeout: DEFAULT_TIMEOUT)

```

Forks the Sandbox, creating a new Sandbox with an identical filesystem.
The forked Sandbox is a copy-on-write clone of the original. It starts
with the same disk contents but operates independently from that point on.

**Parameters**:

- `name` _String, nil_ - Optional name for the forked Sandbox
- `timeout` _Numeric_ - Maximum wait time in seconds (defaults to 60 s)

**Returns**:

- `Daytona:Sandbox` - The forked Sandbox

#### create_snapshot()

```ruby
def create_snapshot(name:, timeout: DEFAULT_TIMEOUT)

```

Creates a snapshot from the current state of the Sandbox.
The Sandbox will temporarily enter a 'snapshotting' state and return to its previous state when complete.

**Parameters**:

- `name` _String_ - Name for the new snapshot
- `timeout` _Numeric_ - Maximum wait time in seconds (defaults to 60 s)

**Returns**:

- `void`

#### experimental_fork()

```ruby
def experimental_fork(name: nil, timeout: DEFAULT_TIMEOUT)

```

Deprecated: Use +fork+ instead. This method will be removed in a future version.

#### experimental_create_snapshot()

```ruby
def experimental_create_snapshot(name:, timeout: DEFAULT_TIMEOUT)

```

Deprecated: Use +create_snapshot+ instead. This method will be removed in a future version.

#### pause()

```ruby
def pause(timeout: DEFAULT_TIMEOUT)

```

Pauses the Sandbox, freezing all running processes.
Completes when the Sandbox has left the +pausing+ state (paused, stopped,
archived, etc.); error states still raise.

**Parameters**:

- `timeout` _Numeric_ - Maximum wait time in seconds (defaults to 60 s)

**Returns**:

- `void`

## See Also
- [Python SDK - sandbox](../python-sdk/sync/sandbox.md)
- [TypeScript SDK - sandbox](../typescript-sdk/sandbox.md)
- [Java SDK - sandbox](../java-sdk/sandbox.md)
