-- migrate:up
CREATE TABLE mcp_oauth_grants (
  id uuid PRIMARY KEY,
  session_id text NOT NULL UNIQUE,
  session_kind text NOT NULL DEFAULT 'foreman' CHECK (session_kind = 'foreman'),
  resource text NOT NULL CHECK (btrim(resource) <> ''),
  client_secret_hash text NOT NULL CHECK (client_secret_hash ~ '^[0-9a-f]{64}$'),
  refresh_token_hash text NOT NULL CHECK (refresh_token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at),
  revoked_at timestamptz CHECK (revoked_at IS NULL OR revoked_at >= created_at),
  FOREIGN KEY (session_id, session_kind) REFERENCES sessions (id, kind) ON DELETE CASCADE
);

-- migrate:down
DROP TABLE mcp_oauth_grants;
