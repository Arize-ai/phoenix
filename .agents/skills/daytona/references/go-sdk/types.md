

# types


## Contents

- Index
- Constants
- type Chart
- type CodeLanguage
- type CodeRunParams
- type CreateSecretParams
- type CreateSnapshotParams
- type CreateWarmPoolParams
- type DaytonaConfig
- type ExecuteResponse
- type ExecutionArtifacts
- type ExecutionError
- type ExecutionResult
- type ExperimentalConfig
- type FileDownloadRequest
- type FileDownloadResponse
- type FileInfo
- type FileStatus
- type FileUpload
- type GitCommitResponse
- type GitRemote
- type GitStatus
- type GpuType
- type ImageParams
- type ListSecretsQuery
- type ListSecretsResponse
- type LspLanguageID
- type OutputMessage
- type PaginatedSnapshots
- type Position
- type PreviewLink
- type PtyResult
- type PtySessionInfo
- type PtySize
- type Resources
- type SandboxBaseParams
- type SandboxClass
- type ScreenshotOptions
- type ScreenshotRegion
- type ScreenshotResponse
- type Secret
- type SignedPreviewLink
- type Snapshot
- type SnapshotParams
- type UpdateSecretParams
- type Volume
- type VolumeMount
- type WarmPool

```go
import "github.com/daytona/clients/sdk-go/pkg/types"
```

## Index

- [Constants](https://www.daytona.io/docs/en<#constants>)
- [type Chart](https://www.daytona.io/docs/en<#Chart>)
- [type CodeLanguage](https://www.daytona.io/docs/en<#CodeLanguage>)
- [type CodeRunParams](https://www.daytona.io/docs/en<#CodeRunParams>)
- [type CreateSecretParams](https://www.daytona.io/docs/en<#CreateSecretParams>)
- [type CreateSnapshotParams](https://www.daytona.io/docs/en<#CreateSnapshotParams>)
- [type CreateWarmPoolParams](https://www.daytona.io/docs/en<#CreateWarmPoolParams>)
- [type DaytonaConfig](https://www.daytona.io/docs/en<#DaytonaConfig>)
- [type ExecuteResponse](https://www.daytona.io/docs/en<#ExecuteResponse>)
- [type ExecutionArtifacts](https://www.daytona.io/docs/en<#ExecutionArtifacts>)
- [type ExecutionError](https://www.daytona.io/docs/en<#ExecutionError>)
- [type ExecutionResult](https://www.daytona.io/docs/en<#ExecutionResult>)
- [type ExperimentalConfig](https://www.daytona.io/docs/en<#ExperimentalConfig>)
- [type FileDownloadRequest](https://www.daytona.io/docs/en<#FileDownloadRequest>)
- [type FileDownloadResponse](https://www.daytona.io/docs/en<#FileDownloadResponse>)
- [type FileInfo](https://www.daytona.io/docs/en<#FileInfo>)
- [type FileStatus](https://www.daytona.io/docs/en<#FileStatus>)
- [type FileUpload](https://www.daytona.io/docs/en<#FileUpload>)
- [type GitCommitResponse](https://www.daytona.io/docs/en<#GitCommitResponse>)
- [type GitRemote](https://www.daytona.io/docs/en<#GitRemote>)
- [type GitStatus](https://www.daytona.io/docs/en<#GitStatus>)
- [type GpuType](https://www.daytona.io/docs/en<#GpuType>)
- [type ImageParams](https://www.daytona.io/docs/en<#ImageParams>)
- [type ListSecretsQuery](https://www.daytona.io/docs/en<#ListSecretsQuery>)
- [type ListSecretsResponse](https://www.daytona.io/docs/en<#ListSecretsResponse>)
- [type LspLanguageID](https://www.daytona.io/docs/en<#LspLanguageID>)
- [type OutputMessage](https://www.daytona.io/docs/en<#OutputMessage>)
- [type PaginatedSnapshots](https://www.daytona.io/docs/en<#PaginatedSnapshots>)
- [type Position](https://www.daytona.io/docs/en<#Position>)
- [type PreviewLink](https://www.daytona.io/docs/en<#PreviewLink>)
- [type PtyResult](https://www.daytona.io/docs/en<#PtyResult>)
- [type PtySessionInfo](https://www.daytona.io/docs/en<#PtySessionInfo>)
- [type PtySize](https://www.daytona.io/docs/en<#PtySize>)
- [type Resources](https://www.daytona.io/docs/en<#Resources>)
- [type SandboxBaseParams](https://www.daytona.io/docs/en<#SandboxBaseParams>)
- [type SandboxClass](https://www.daytona.io/docs/en<#SandboxClass>)
- [type ScreenshotOptions](https://www.daytona.io/docs/en<#ScreenshotOptions>)
- [type ScreenshotRegion](https://www.daytona.io/docs/en<#ScreenshotRegion>)
- [type ScreenshotResponse](https://www.daytona.io/docs/en<#ScreenshotResponse>)
- [type Secret](https://www.daytona.io/docs/en<#Secret>)
- [type SignedPreviewLink](https://www.daytona.io/docs/en<#SignedPreviewLink>)
- [type Snapshot](https://www.daytona.io/docs/en<#Snapshot>)
- [type SnapshotParams](https://www.daytona.io/docs/en<#SnapshotParams>)
- [type UpdateSecretParams](https://www.daytona.io/docs/en<#UpdateSecretParams>)
- [type Volume](https://www.daytona.io/docs/en<#Volume>)
- [type VolumeMount](https://www.daytona.io/docs/en<#VolumeMount>)
- [type WarmPool](https://www.daytona.io/docs/en<#WarmPool>)


## Constants

<a name="CodeToolboxLanguageLabel"></a>

```go
const CodeToolboxLanguageLabel = "code-toolbox-language"
```

<a name="Chart"></a>
## type Chart


```go
type Chart = toolbox.Chart
```

<a name="CodeLanguage"></a>
## type CodeLanguage

CodeLanguage

```go
type CodeLanguage string
```

<a name="CodeLanguagePython"></a>

```go
const (
    CodeLanguagePython     CodeLanguage = "python"
    CodeLanguageJavaScript CodeLanguage = "javascript"
    CodeLanguageTypeScript CodeLanguage = "typescript"
)
```

<a name="CodeRunParams"></a>
## type CodeRunParams

CodeRunParams represents parameters for code execution

```go
type CodeRunParams struct {
    Argv []string
    Env  map[string]string
}
```

<a name="CreateSecretParams"></a>
## type CreateSecretParams

CreateSecretParams contains parameters for creating a secret.

```go
type CreateSecretParams struct {
    // Name is the secret name. It must match ^[a-zA-Z_][a-zA-Z0-9_-]*$ and be
    // unique within the organization (a duplicate name returns a 409 conflict).
    Name string
    // Value is the plaintext secret value. It is write-only and never returned.
    Value string
    // Description is an optional human-readable description.
    Description *string
    // Hosts are the allowed hosts this secret may be sent to. Entries are exact
    // hostnames or "*." wildcards (without ports).
    Hosts []string
}
```

<a name="CreateSnapshotParams"></a>
## type CreateSnapshotParams

CreateSnapshotParams represents parameters for creating a snapshot

```go
type CreateSnapshotParams struct {
    Name           string
    Image          any // string or *Image
    Resources      *Resources
    Entrypoint     []string
    SkipValidation *bool
    SandboxClass   *SandboxClass
}
```

<a name="CreateWarmPoolParams"></a>
## type CreateWarmPoolParams

CreateWarmPoolParams contains parameters for creating a warm pool.

```go
type CreateWarmPoolParams struct {
    // Snapshot is the snapshot (ID or name) to keep warm sandboxes for.
    Snapshot string
    // Pool is the number of warm sandboxes to keep ready.
    Pool int
    // Target is the target region for the warm pool. Defaults to the
    // organization default region when nil.
    Target *string
}
```

<a name="DaytonaConfig"></a>
## type DaytonaConfig

DaytonaConfig represents the configuration for the Daytona client. When a field is nil, the client will fall back to environment variables or defaults.

```go
type DaytonaConfig struct {
    APIKey         string
    JWTToken       string
    OrganizationID string
    APIUrl         string
    Target         string
    OtelEnabled    bool // Enable OpenTelemetry tracing for SDK operations.
    // UseDeprecatedPolling observes sandbox state by legacy polling instead of
    // WebSocket event streaming. Defaults to false (event streaming). Can also be
    // enabled via the DAYTONA_USE_DEPRECATED_POLLING environment variable.
    //
    // Deprecated: polling-only mode will be removed in a future release; event
    // streaming is the default and falls back to polling automatically when
    // WebSockets are unavailable.
    UseDeprecatedPolling *bool
    // Timeout overrides the default per-request HTTP timeout (60s). A
    // non-positive value disables the client-wide timeout entirely. Executions
    // with an explicit execution timeout are not capped by this value.
    Timeout *time.Duration
    // HTTPClient supplies a custom *http.Client for API requests. It is copied
    // before use (Transport shared); Timeout, when set, overrides the copy's.
    HTTPClient   *http.Client
    Experimental *ExperimentalConfig
}
```

<a name="ExecuteResponse"></a>
## type ExecuteResponse

ExecuteResponse represents a command execution response

```go
type ExecuteResponse struct {
    ExitCode  int
    Result    string
    Artifacts *ExecutionArtifacts // nil when no artifacts available
}
```

<a name="ExecutionArtifacts"></a>
## type ExecutionArtifacts

ExecutionArtifacts represents execution output artifacts

```go
type ExecutionArtifacts struct {
    Stdout string
    Charts []Chart
}
```

<a name="ExecutionError"></a>
## type ExecutionError

ExecutionError represents a code execution error

```go
type ExecutionError struct {
    Name      string
    Value     string
    Traceback *string // Optional stack trace; nil when not available
}
```

<a name="ExecutionResult"></a>
## type ExecutionResult

ExecutionResult represents code interpreter execution result

```go
type ExecutionResult struct {
    Stdout string
    Stderr string
    Charts []Chart         // Optional charts from matplotlib
    Error  *ExecutionError // nil = success, non-nil = execution failed
}
```

<a name="ExperimentalConfig"></a>
## type ExperimentalConfig

ExperimentalConfig holds experimental feature flags for the Daytona client.

```go
type ExperimentalConfig struct {
    // Deprecated: use DaytonaConfig.OtelEnabled. Kept for backwards compatibility.
    OtelEnabled bool
}
```

<a name="FileDownloadRequest"></a>
## type FileDownloadRequest

FileDownloadRequest

```go
type FileDownloadRequest struct {
    Source      string
    Destination *string // nil = download to memory (return []byte), non-nil = save to file path
}
```

<a name="FileDownloadResponse"></a>
## type FileDownloadResponse

FileDownloadResponse represents a file download response

```go
type FileDownloadResponse struct {
    Source string
    Result any     // []byte or string (path)
    Error  *string // nil = success, non-nil = error message
}
```

<a name="FileInfo"></a>
## type FileInfo

FileInfo represents file metadata

```go
type FileInfo struct {
    Name         string
    Path         string
    Size         int64
    Mode         string
    ModifiedTime time.Time
    IsDirectory  bool
}
```

<a name="FileStatus"></a>
## type FileStatus

FileStatus represents the status of a file in git

```go
type FileStatus struct {
    Path   string
    Status string
}
```

<a name="FileUpload"></a>
## type FileUpload

FileUpload represents a file to upload

```go
type FileUpload struct {
    Source      any // []byte or string (path)
    Destination string
}
```

<a name="GitCommitResponse"></a>
## type GitCommitResponse

GitCommitResponse

```go
type GitCommitResponse struct {
    SHA string
}
```

<a name="GitRemote"></a>
## type GitRemote

GitRemote describes a configured Git remote.

```go
type GitRemote struct {
    Name string
    URL  string
}
```

<a name="GitStatus"></a>
## type GitStatus

GitStatus represents git repository status

```go
type GitStatus struct {
    CurrentBranch   string
    Ahead           int
    Behind          int
    BranchPublished bool
    FileStatus      []FileStatus
    // Detached is true when HEAD is not on a branch (detached HEAD state).
    Detached bool
    // Upstream is the upstream tracking branch (e.g. "origin/main"), empty when unset.
    Upstream string
}
```

<a name="GpuType"></a>
## type GpuType

GpuType identifies a specific GPU model. Used in \[Resources.GpuType\] as an ordered preference list — the scheduler tries each in order and pins the sandbox/snapshot to the first that has capacity. It is an alias for the API client's GpuType type.

```go
type GpuType = apiclient.GpuType
```

<a name="GpuTypeH100"></a>

```go
const (
    GpuTypeH100       GpuType = apiclient.GPUTYPE_H100
    GpuTypeRtxPro6000 GpuType = apiclient.GPUTYPE_RTX_PRO_6000
    GpuTypeMI355X     GpuType = apiclient.GPUTYPE_MI355X
)
```

<a name="ImageParams"></a>
## type ImageParams

ImageParams represents parameters for creating a sandbox from an image

```go
type ImageParams struct {
    SandboxBaseParams
    Image     any // string or *Image
    Resources *Resources
}
```

<a name="ListSecretsQuery"></a>
## type ListSecretsQuery

ListSecretsQuery contains query parameters for filtering, sorting, and paginating when listing secrets. All fields are optional.

```go
type ListSecretsQuery struct {
    // Pagination cursor from a previous response's NextCursor
    Cursor *string
    // Number of results per page (1-200, default 100)
    Limit *int
    // Filter by partial name match
    Name *string
    // Sort by field: "name", "createdAt", or "updatedAt" (default "createdAt")
    Sort *string
    // Sort direction: "asc" or "desc" (default "desc")
    Order *string
}
```

<a name="ListSecretsResponse"></a>
## type ListSecretsResponse

ListSecretsResponse represents a paginated list of secrets

```go
type ListSecretsResponse struct {
    Items []*Secret
    // Total number of secrets matching the filters
    Total int
    // Cursor for the next page of results; nil when there are no further pages
    NextCursor *string
}
```

<a name="LspLanguageID"></a>
## type LspLanguageID


```go
type LspLanguageID string
```

<a name="LspLanguagePython"></a>

```go
const (
    LspLanguagePython     LspLanguageID = "python"
    LspLanguageJavaScript LspLanguageID = "javascript"
    LspLanguageTypeScript LspLanguageID = "typescript"
)
```

<a name="OutputMessage"></a>
## type OutputMessage

OutputMessage represents an output message

```go
type OutputMessage struct {
    Type      string `json:"type"`
    Text      string `json:"text"`
    Name      string `json:"name"`
    Value     string `json:"value"`
    Traceback string `json:"traceback"`
}
```

<a name="PaginatedSnapshots"></a>
## type PaginatedSnapshots

PaginatedSnapshots represents a paginated list of snapshots

```go
type PaginatedSnapshots struct {
    Items      []*Snapshot
    Total      int
    Page       int
    TotalPages int
}
```

<a name="Position"></a>
## type Position

Position represents a position in a document

```go
type Position struct {
    Line      int // zero-based
    Character int // zero-based
}
```

<a name="PreviewLink"></a>
## type PreviewLink

PreviewLink contains the URL and authentication token for a sandbox preview.

```go
type PreviewLink struct {
    URL   string
    Token string
}
```

<a name="PtyResult"></a>
## type PtyResult

PtyResult represents PTY session exit information

```go
type PtyResult struct {
    ExitCode *int    // nil = process still running, non-nil = exit code
    Error    *string // nil = success, non-nil = error message
}
```

<a name="PtySessionInfo"></a>
## type PtySessionInfo

PtySessionInfo represents PTY session information

```go
type PtySessionInfo struct {
    ID        string
    Active    bool
    CWD       string // Current working directory; may be empty unavailable
    Cols      int
    Rows      int
    ProcessID *int // Process ID; may be nil if unavailable
    CreatedAt time.Time
}
```

<a name="PtySize"></a>
## type PtySize

PtySize represents terminal dimensions

```go
type PtySize struct {
    Rows int
    Cols int
}
```

<a name="Resources"></a>
## type Resources

Resources represents resource allocation for a sandbox.

```go
type Resources struct {
    CPU     int
    GPU     int
    GpuType []GpuType
    Memory  int
    Disk    int
}
```

<a name="SandboxBaseParams"></a>
## type SandboxBaseParams

SandboxBaseParams contains common parameters for sandbox creation.

```go
type SandboxBaseParams struct {
    Name                string
    User                string
    Language            CodeLanguage
    EnvVars             map[string]string
    Labels              map[string]string
    Public              bool
    AutoStopInterval    *int // nil = no auto-stop, 0 = immediate stop
    AutoPauseInterval   *int // nil = server default when AutoStopInterval is also nil (60 for non-ephemeral pause-supporting classes, with auto-stop disabled), 0 = disabled. Only supported for sandbox classes that support pausing. Not allowed for ephemeral sandboxes. At most one of AutoPauseInterval and AutoStopInterval may be non-zero.
    AutoArchiveInterval *int // nil = no auto-archive, 0 = immediate archive
    AutoDeleteInterval  *int // nil = no auto-delete, 0 = immediate delete
    TtlMinutes          *int // Wall-clock max lifetime in minutes; 0 disables TTL
    Volumes             []VolumeMount
    // Secrets maps an environment variable name to the name of an existing
    // organization secret. For each entry, the env var is injected into the
    // sandbox holding the secret's opaque placeholder, which is resolved to the
    // real value only when the sandbox connects to one of the secret's allowed
    // hosts. The referenced secrets must already exist (see [Client.Secret]).
    Secrets          map[string]string
    NetworkBlockAll  bool
    NetworkAllowList *string
    DomainAllowList  *string
    // OutboundProxyUrl is the outbound proxy URL the sandbox HTTP(S) traffic is
    // routed through. Applied via the HTTP(S)_PROXY environment variables;
    // combine with DomainAllowList for network-layer enforcement.
    OutboundProxyUrl *string
    // OtelEndpointOverride is the OTel collector endpoint override for the sandbox.
    // When set, sandbox OTel data is sent to this endpoint instead of the default
    // collector and will not be available in the Daytona analytics API or dashboard.
    OtelEndpointOverride *string
    Ephemeral            bool
    // Spot marks the sandbox as a spot GPU sandbox. A spot sandbox may be instantly
    // terminated without notice to free GPU capacity for an on-demand (non-spot) GPU
    // sandbox. Rejected when the sandbox requests no GPUs.
    Spot bool
    // LinkedSandbox is the ID or name of an existing sandbox to link the new sandbox to.
    // The new sandbox will be scheduled on the same runner as the linked sandbox so a local
    // network can be established between them.
    // Linked sandboxes must be ephemeral (AutoDeleteInterval=0) and cannot themselves be
    // linked to another sandbox.
    LinkedSandbox string
}
```

<a name="SandboxClass"></a>
## type SandboxClass

SandboxClass determines which runners can host sandboxes created from a snapshot. It is an alias for the API client's SandboxClass type.

```go
type SandboxClass = apiclient.SandboxClass
```

<a name="SandboxClassLinuxVM"></a>

```go
const (
    SandboxClassLinuxVM   SandboxClass = apiclient.SANDBOXCLASS_LINUX_VM
    SandboxClassContainer SandboxClass = apiclient.SANDBOXCLASS_CONTAINER
)
```

<a name="ScreenshotOptions"></a>
## type ScreenshotOptions


```go
type ScreenshotOptions struct {
    ShowCursor *bool    // nil = default, true = show, false = hide
    Format     *string  // nil = default format (PNG), or "jpeg", "webp", etc.
    Quality    *int     // nil = default quality, 0-100 for JPEG/WebP
    Scale      *float64 // nil = 1.0, scaling factor for the screenshot
}
```

<a name="ScreenshotRegion"></a>
## type ScreenshotRegion

ScreenshotRegion represents a screenshot region

```go
type ScreenshotRegion struct {
    X      int
    Y      int
    Width  int
    Height int
}
```

<a name="ScreenshotResponse"></a>
## type ScreenshotResponse


```go
type ScreenshotResponse struct {
    Image     string // base64-encoded image data
    Width     int
    Height    int
    SizeBytes *int // Size in bytes
}
```

<a name="Secret"></a>
## type Secret

Secret represents an organization\-scoped secret.

A Secret stores a write\-only plaintext value that is never returned by the API. When referenced from a sandbox, the env var holds the opaque \[Secret.Placeholder\] token, which is resolved to the real value only for the secret's allowed \[Secret.Hosts\].

```go
type Secret struct {
    ID          string  `json:"id"`
    Name        string  `json:"name"`
    Description *string `json:"description,omitempty"`
    // Placeholder is the opaque token injected as the env var value in sandboxes.
    Placeholder string `json:"placeholder"`
    // Hosts are the allowed hosts this secret may be sent to. Entries are exact
    // hostnames or "*." wildcards (without ports).
    Hosts     []string  `json:"hosts"`
    CreatedAt time.Time `json:"createdAt"`
    UpdatedAt time.Time `json:"updatedAt"`
}
```

<a name="SignedPreviewLink"></a>
## type SignedPreviewLink

SignedPreviewLink contains the signed URL, authentication token, port, and sandbox ID for a sandbox preview.

```go
type SignedPreviewLink struct {
    SandboxID string
    Port      int
    Token     string
    URL       string
}
```

<a name="Snapshot"></a>
## type Snapshot

Snapshot represents a Daytona snapshot

```go
type Snapshot struct {
    ID             string     `json:"id"`
    OrganizationID string     `json:"organizationId,omitempty"`
    General        bool       `json:"general"`
    Name           string     `json:"name"`
    ImageName      string     `json:"imageName,omitempty"`
    State          string     `json:"state"`
    Size           *float64   `json:"size,omitempty"`
    Entrypoint     []string   `json:"entrypoint,omitempty"`
    CPU            int        `json:"cpu"`
    GPU            int        `json:"gpu"`
    Memory         int        `json:"mem"` // API uses "mem" not "memory"
    Disk           int        `json:"disk"`
    ErrorReason    *string    `json:"errorReason,omitempty"` // nil = success, non-nil = error reason if snapshot failed
    SkipValidation bool       `json:"skipValidation"`
    CreatedAt      time.Time  `json:"createdAt"`
    UpdatedAt      time.Time  `json:"updatedAt"`
    LastUsedAt     *time.Time `json:"lastUsedAt,omitempty"`
    // ID of the sandbox the snapshot was created from; nil for snapshots not
    // created from a sandbox (e.g. registry-pulled or declaratively built)
    SourceSandboxID *string `json:"sourceSandboxId,omitempty"`
}
```

<a name="SnapshotParams"></a>
## type SnapshotParams

SnapshotParams represents parameters for creating a sandbox from a snapshot

```go
type SnapshotParams struct {
    SandboxBaseParams
    Snapshot string
}
```

<a name="UpdateSecretParams"></a>
## type UpdateSecretParams

UpdateSecretParams contains parameters for updating a secret. Only the non\-nil fields are applied.

```go
type UpdateSecretParams struct {
    // Value is the new plaintext secret value. It is write-only and never returned.
    Value *string
    // Description is an optional human-readable description.
    Description *string
    // Hosts are the allowed hosts this secret may be sent to. Entries are exact
    // hostnames or "*." wildcards (without ports).
    Hosts []string
}
```

<a name="Volume"></a>
## type Volume

Volume represents a Daytona volume

```go
type Volume struct {
    ID             string    `json:"id"`
    Name           string    `json:"name"`
    OrganizationID string    `json:"organizationId"`
    State          string    `json:"state"`
    ErrorReason    *string   `json:"errorReason,omitempty"`
    CreatedAt      time.Time `json:"createdAt"`
    UpdatedAt      time.Time `json:"updatedAt"`
    LastUsedAt     time.Time `json:"lastUsedAt,omitempty"`
}
```

<a name="VolumeMount"></a>
## type VolumeMount

VolumeMount represents a volume mount configuration

```go
type VolumeMount struct {
    VolumeID  string // ID or name of the volume to mount
    MountPath string
    Subpath   *string // Optional subpath within the volume; nil = mount entire volume
}
```

<a name="WarmPool"></a>
## type WarmPool

WarmPool represents a warm pool of ready\-to\-use sandboxes for a snapshot.

CurrentSize versus Pool is the pool's status: CurrentSize is the number of ready warm sandboxes, Pool is the desired number. ErrorReason is set when the pool cannot be filled.

```go
type WarmPool struct {
    ID             string `json:"id"`
    OrganizationID string `json:"organizationId"`
    // Snapshot is the snapshot the pool keeps warm sandboxes for.
    Snapshot string `json:"snapshot"`
    // Target is the target region of the pool.
    Target string `json:"target"`
    // Pool is the desired number of warm sandboxes.
    Pool int `json:"pool"`
    // CurrentSize is the current number of ready warm sandboxes in the pool.
    CurrentSize int               `json:"currentSize"`
    CPU         int               `json:"cpu"`
    Mem         int               `json:"mem"`
    Disk        int               `json:"disk"`
    OsUser      string            `json:"osUser"`
    Env         map[string]string `json:"env"`
    // ErrorReason is set when the pool cannot be filled.
    ErrorReason *string   `json:"errorReason,omitempty"`
    CreatedAt   time.Time `json:"createdAt"`
    UpdatedAt   time.Time `json:"updatedAt"`
}
```
