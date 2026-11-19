# Types (Python SDK reference)

## ArtifactRefJSON

```python
class ArtifactRefJSON(TypedDict)
```

An image or snapshot reference inside `SandboxHandleJSON`
(`name` is present only when known).

**Attributes**:

- `id` _str_
- `name` _NotRequired\[str\]_

## StorageLimits

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class StorageLimits()
```

**Attributes**:

- `volumes` _UsageLimit_
- `images` _UsageLimit_
- `snapshots` _UsageLimit_

## ProjectApiKeyContext

```python
@dataclass(frozen=True, slots=True, kw_only=True)
class ProjectApiKeyContext()
```

The project and organization an API key acts in.

**Attributes**:

- `org_id` _str_
- `org_name` _str_
- `project_name` _str_
