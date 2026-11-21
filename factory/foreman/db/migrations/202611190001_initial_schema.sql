-- migrate:up
CREATE FUNCTION github_node_identity(node_id text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE
AS $$
DECLARE
  payload text;
  decoded bytea;
  legacy_id text[];
  element_count integer;
  position integer := 1;
  marker integer;
  integer_bytes integer;
  value numeric;
  string_length integer;
  identity_value text;
BEGIN
  IF node_id ~ '^[A-Z]+_[A-Za-z0-9_-]+$' THEN
    payload := translate(substring(node_id FROM strpos(node_id, '_') + 1), '-_', '+/');
    decoded := decode(payload || repeat('=', (4 - length(payload) % 4) % 4), 'base64');
    element_count := get_byte(decoded, 0) - 144;
    IF element_count NOT IN (2, 3, 4) THEN
      RAISE EXCEPTION 'Unsupported GitHub node ID array: %', node_id USING ERRCODE = '22023';
    END IF;
    FOR element IN 1..element_count LOOP
      marker := get_byte(decoded, position);
      position := position + 1;
      IF marker <= 127 THEN
        value := marker;
      ELSIF element = element_count AND element_count = 3 AND marker IN (217, 218) THEN
        integer_bytes := CASE marker WHEN 217 THEN 1 WHEN 218 THEN 2 END;
        string_length := 0;
        FOR byte_index IN 1..integer_bytes LOOP
          string_length := string_length * 256 + get_byte(decoded, position);
          position := position + 1;
        END LOOP;
        identity_value := convert_from(substring(decoded FROM position + 1 FOR string_length), 'UTF8');
        position := position + string_length;
        IF string_length <> 40 OR identity_value !~ '^[0-9a-f]{40}$' OR node_id !~ '^C_' THEN
          RAISE EXCEPTION 'Unsupported GitHub commit node ID: %', node_id USING ERRCODE = '22023';
        END IF;
        EXIT;
      ELSE
        integer_bytes := CASE marker WHEN 204 THEN 1 WHEN 205 THEN 2 WHEN 206 THEN 4 WHEN 207 THEN 8 END;
        IF integer_bytes IS NULL THEN
          RAISE EXCEPTION 'Expected an unsigned integer in GitHub node ID: %', node_id USING ERRCODE = '22023';
        END IF;
        value := 0;
        FOR byte_index IN 1..integer_bytes LOOP
          value := value * 256 + get_byte(decoded, position);
          position := position + 1;
        END LOOP;
      END IF;
      IF (element = 1 AND value <> 0) OR (element > 1 AND value <= 0) THEN
        RAISE EXCEPTION 'Unsupported GitHub node ID value: %', node_id USING ERRCODE = '22023';
      END IF;
    END LOOP;
    IF position <> octet_length(decoded) THEN
      RAISE EXCEPTION 'Trailing data in GitHub node ID: %', node_id USING ERRCODE = '22023';
    END IF;
    RETURN coalesce(identity_value, value::text);
  END IF;

  decoded := decode(node_id, 'base64');
  legacy_id := regexp_match(convert_from(decoded, 'UTF8'), '^[0-9]+:Commit[0-9]+:([0-9a-f]{40})$');
  IF legacy_id IS NOT NULL THEN
    RETURN legacy_id[1];
  END IF;
  legacy_id := regexp_match(convert_from(decoded, 'UTF8'), '^[0-9]+:[A-Za-z]+([0-9]+)$');
  IF legacy_id IS NULL OR legacy_id[1]::bigint <= 0 THEN
    RAISE EXCEPTION 'Unsupported GitHub node ID: %', node_id USING ERRCODE = '22023';
  END IF;
  RETURN legacy_id[1];
END;
$$;

CREATE FUNCTION github_database_id(node_id text)
RETURNS bigint
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$ SELECT github_node_identity(node_id)::bigint $$;

CREATE FUNCTION fill_github_database_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.id := github_database_id(NEW.node_id);
  RETURN NEW;
END;
$$;

CREATE TABLE repositories (
  id bigint PRIMARY KEY,
  node_id text NOT NULL UNIQUE,
  owner text NOT NULL,
  name text NOT NULL,
  UNIQUE (owner, name)
);

ALTER TABLE repositories ADD CHECK (id > 0);
ALTER TABLE repositories ADD CHECK (id = github_database_id(node_id));
CREATE TRIGGER fill_github_id BEFORE INSERT OR UPDATE ON repositories
FOR EACH ROW WHEN (NEW.id IS NULL) EXECUTE FUNCTION fill_github_database_id();

CREATE TABLE users (
  id bigint PRIMARY KEY,
  node_id text NOT NULL UNIQUE,
  login text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('human', 'factory', 'other_bot'))
);

ALTER TABLE users ADD CHECK (id > 0);
ALTER TABLE users ADD CHECK (id = github_database_id(node_id));
CREATE TRIGGER fill_github_id BEFORE INSERT OR UPDATE ON users
FOR EACH ROW WHEN (NEW.id IS NULL) EXECUTE FUNCTION fill_github_database_id();

CREATE TABLE issues (
  id bigint PRIMARY KEY,
  node_id text NOT NULL UNIQUE,
  repo_id bigint NOT NULL REFERENCES repositories(id),
  author_id bigint REFERENCES users(id),
  number integer NOT NULL CHECK (number > 0),
  title text NOT NULL,
  github_created_at timestamptz NOT NULL,
  github_updated_at timestamptz,
  UNIQUE (repo_id, number)
);

ALTER TABLE issues ADD CHECK (id > 0);
ALTER TABLE issues ADD CHECK (id = github_database_id(node_id));
CREATE TRIGGER fill_github_id BEFORE INSERT OR UPDATE ON issues
FOR EACH ROW WHEN (NEW.id IS NULL) EXECUTE FUNCTION fill_github_database_id();

CREATE TABLE pull_requests (
  id bigint PRIMARY KEY,
  node_id text NOT NULL UNIQUE,
  repo_id bigint NOT NULL REFERENCES repositories(id),
  author_id bigint REFERENCES users(id),
  number integer NOT NULL CHECK (number > 0),
  title text NOT NULL,
  head_ref text,
  github_created_at timestamptz NOT NULL,
  github_updated_at timestamptz,
  UNIQUE (repo_id, number)
);

ALTER TABLE pull_requests ADD CHECK (id > 0);
ALTER TABLE pull_requests ADD CHECK (id = github_database_id(node_id));
CREATE TRIGGER fill_github_id BEFORE INSERT OR UPDATE ON pull_requests
FOR EACH ROW WHEN (NEW.id IS NULL) EXECUTE FUNCTION fill_github_database_id();

ALTER TABLE repositories ADD CHECK (btrim(owner) <> '');
ALTER TABLE repositories ADD CHECK (btrim(name) <> '');
ALTER TABLE issues ADD CHECK (github_updated_at IS NULL OR github_updated_at >= github_created_at);
ALTER TABLE pull_requests ADD CHECK (github_updated_at IS NULL OR github_updated_at >= github_created_at);

CREATE TABLE sessions (
  id text PRIMARY KEY CHECK (btrim(id) <> ''),
  kind text NOT NULL CHECK (kind IN ('coordinator', 'worker')),
  UNIQUE (id, kind)
);

CREATE TABLE slack_threads (
  workspace_id text NOT NULL CHECK (btrim(workspace_id) <> ''),
  channel_id text NOT NULL CHECK (btrim(channel_id) <> ''),
  thread_timestamp text NOT NULL,
  session_id text NOT NULL UNIQUE,
  session_kind text NOT NULL DEFAULT 'coordinator' CHECK (session_kind = 'coordinator'),
  PRIMARY KEY (workspace_id, channel_id, thread_timestamp),
  FOREIGN KEY (session_id, session_kind) REFERENCES sessions (id, kind)
);

CREATE TABLE issues_sessions (
  issue_id bigint NOT NULL REFERENCES issues(id),
  session_id text NOT NULL,
  session_kind text NOT NULL DEFAULT 'worker' CHECK (session_kind = 'worker'),
  PRIMARY KEY (issue_id, session_id),
  FOREIGN KEY (session_id, session_kind) REFERENCES sessions (id, kind)
);
CREATE INDEX issues_sessions_session ON issues_sessions(session_id);

CREATE TABLE pull_requests_sessions (
  pull_request_id bigint NOT NULL REFERENCES pull_requests(id),
  session_id text NOT NULL,
  session_kind text NOT NULL DEFAULT 'worker' CHECK (session_kind = 'worker'),
  PRIMARY KEY (pull_request_id, session_id),
  FOREIGN KEY (session_id, session_kind) REFERENCES sessions (id, kind)
);
CREATE INDEX pull_requests_sessions_session ON pull_requests_sessions(session_id);

-- migrate:down
DROP TABLE pull_requests_sessions, issues_sessions, slack_threads, sessions;
DROP TABLE pull_requests, issues, users, repositories;
DROP FUNCTION fill_github_database_id();
DROP FUNCTION github_database_id(text);
DROP FUNCTION github_node_identity(text);
