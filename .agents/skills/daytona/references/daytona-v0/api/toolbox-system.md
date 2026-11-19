# System API

## GET `/system/metrics` {#daytona-toolbox/tag/system/GET/system/metrics}

**Get sandbox resource metrics**

Latest CPU/memory/disk usage snapshot for the sandbox. cpuUsedPct is the
average CPU usage as a percentage of the CPU limit over the last sample
window (0 until the first sample completes). Byte fields are in bytes.

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | SystemMetrics |

---
