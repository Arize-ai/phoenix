"""Read-only MCP tools for querying allowlisted Phoenix telemetry tables.

Every authenticated user can already read these tables through ``/v1``, so a
caller's identity would gate nothing here. The reads ``/v1`` does restrict by
role -- ``users``, ``user_api_keys``, ``system_api_keys`` -- are outside the
allowlist."""
