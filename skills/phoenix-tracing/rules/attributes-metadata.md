# Metadata Attributes

Detailed reference for metadata and tracking attributes.

## Session and User

| Attribute | Type | Description | Example |
|-----------|------|-------------|---------|
| `session.id` | String | Session identifier | "session_abc123" |
| `user.id` | String | User identifier | "user_xyz789" |

**Use cases:**
- Group traces by user session
- Per-user analytics and debugging
- A/B testing by user cohort

**Phoenix Behavior:**
- Indexed for fast filtering in UI
- Session view shows all traces in chronological order
- User view shows aggregated metrics

## Custom Metadata

| Attribute Pattern | Type | Description |
|-------------------|------|-------------|
| `metadata.{key}` | Any | Custom key-value metadata |

**Examples:**
```json
{
  "metadata.environment": "production",
  "metadata.model_version": "v2.1",
  "metadata.experiment_id": "exp_456",
  "metadata.feature_flags": "[\"new_ui\", \"beta_model\"]",
  "metadata.cost_center": "engineering",
  "metadata.region": "us-west-2"
}
```

**Best Practices:**
- Use consistent key names across traces
- Store deployment info (environment, version)
- Include experiment/feature identifiers for A/B testing
- Add business context (cost center, customer tier)

## Tags

| Attribute Pattern | Type | Description |
|-------------------|------|-------------|
| `tag.tags.{i}` | String | Tag at index i |

**Example:**
```json
{
  "tag.tags.0": "experiment_a",
  "tag.tags.1": "high_priority",
  "tag.tags.2": "production"
}
```

**Use cases:**
- Categorize traces for filtering
- Mark traces for review
- Label test vs. production traffic

## Agent Identification

For multi-agent systems:

| Attribute | Type | Description | Example |
|-----------|------|-------------|---------|
| `metadata.agent.name` | String | Agent identifier | "travel_agent" |
| `metadata.agent.type` | String | Agent architecture | "react" |
| `metadata.agent.version` | String | Agent version | "v1.2.3" |
