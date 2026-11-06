# Object Storage API

## GET `/object-storage/push-access` {#daytona/tag/object-storage/GET/object-storage/push-access}

**Get temporary storage access for pushing objects**

### Parameters

| Name | In | Type | Required | Description |
|------|-----|------|----------|-------------|
| `X-Daytona-Organization-ID` | header | string | No | Use with JWT to specify the organization ID |

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | Temporary storage access has been generated | StorageAccessDto |

---
