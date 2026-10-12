# Jobs API

## GET `/jobs` {#daytona/tag/jobs/GET/jobs}

**List jobs for the runner**

Returns a paginated list of jobs for the runner, optionally filtered by status.

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `page` | query | number | No | Page number of the results |
| `limit` | query | number | No | Maximum number of jobs to return (default: 100, max: 500) |
| `status` | query | string | No | Filter jobs by status |
| `offset` | query | number | No | Number of jobs to skip for pagination (default: 0) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | List of jobs for the runner | PaginatedJobs |

---

## GET `/jobs/poll` {#daytona/tag/jobs/GET/jobs/poll}

**Long poll for jobs**

Long poll endpoint for runners to fetch pending jobs. Returns immediately if jobs are available, otherwise waits up to timeout seconds.

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `timeout` | query | number | No | Timeout in seconds for long polling (default: 30, max: 60) |
| `limit` | query | number | No | Maximum number of jobs to return (default: 10, max: 100) |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | List of jobs for the runner | PollJobsResponse |

---

## GET `/jobs/{jobId}` {#daytona/tag/jobs/GET/jobs/{jobId}}

**Get job details**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `jobId` | path | string | Yes | ID of the job |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Job details | Job |

---

## POST `/jobs/{jobId}/status` {#daytona/tag/jobs/POST/jobs/{jobId}/status}

**Update job status**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `jobId` | path | string | Yes | ID of the job |

### Request Body

Schema: **UpdateJobStatus**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | object | Yes | The new status of the job |
| `errorMessage` | string | No | Error message if the job failed |
| `resultMetadata` | string | No | Result metadata for the job |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Job status updated successfully | Job |

---
