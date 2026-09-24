# Health API

## GET `/health` {#daytona/tag/Health/GET/health}

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 |  |  |

---

## GET `/health/ready` {#daytona/tag/Health/GET/health/ready}

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | The Health Check is successful | HealthController_check_200_response |
| 503 | The Health Check is not successful | HealthController_check_503_response |

---
