
## ObjectStorage

Initialize ObjectStorage with S3-compatible credentials

### Constructors

#### new ObjectStorage()

```ruby
def initialize(endpoint_url:, aws_access_key_id:, aws_secret_access_key:, aws_session_token:, region:, bucket_name: DEFAULT_BUCKET_NAME)

```

Initialize ObjectStorage with S3-compatible credentials

**Parameters**:

- `endpoint_url` _String_ - The endpoint URL for the object storage service
- `aws_access_key_id` _String_ - The access key ID for the object storage service
- `aws_secret_access_key` _String_ - The secret access key for the object storage service
- `aws_session_token` _String_ - The session token for the object storage service
- `bucket_name` _String_ - The name of the bucket to use (defaults to "daytona-volume-builds")
- `region` _String_ - Region of the storage backend

**Returns**:

- `ObjectStorage` - a new instance of ObjectStorage

### Methods

#### bucket_name()

```ruby
def bucket_name()

```

**Returns**:

- `String` - The name of the S3 bucket used for object storage

#### s3_client()

```ruby
def s3_client()

```

**Returns**:

- `Aws:S3:Client` - The S3 client

#### upload()

```ruby
def upload(path, organization_id, archive_base_path = nil)

```

Uploads a file to the object storage service

**Parameters**:

- `path` _String_ - The path to the file to upload
- `organization_id` _String_ - The organization ID to use
- `archive_base_path` _String, nil_ - The base path to use for the archive

**Returns**:

- `String` - The hash of the uploaded file

**Raises**:

- `Errno:ENOENT` - If the path does not exist

## See Also
- [Python SDK - object-storage](../python-sdk/sync/object-storage.md)
- [TypeScript SDK - object-storage](../typescript-sdk/object-storage.md)
