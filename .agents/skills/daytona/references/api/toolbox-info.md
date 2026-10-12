# Info API

## GET `/user-home-dir` {#daytona-toolbox/tag/info/GET/user-home-dir}

**Get user home directory**

Get the current user home directory path.

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | UserHomeDirResponse |

---

## GET `/version` {#daytona-toolbox/tag/info/GET/version}

**Get version**

Get the current daemon version

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | object |

---

## GET `/work-dir` {#daytona-toolbox/tag/info/GET/work-dir}

**Get working directory**

Get the current working directory path. This is default directory used for running commands.

### Responses

| Status | Description | Schema |
|--------|-------------|--------|
| 200 | OK | WorkDirResponse |

---
