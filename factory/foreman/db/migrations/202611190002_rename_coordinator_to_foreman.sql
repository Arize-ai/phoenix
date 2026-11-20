-- migrate:up
ALTER TABLE slack_threads DROP CONSTRAINT slack_threads_session_id_session_kind_fkey;
ALTER TABLE slack_threads DROP CONSTRAINT slack_threads_session_kind_check;
ALTER TABLE sessions DROP CONSTRAINT sessions_kind_check;

UPDATE sessions SET kind = 'foreman' WHERE kind = 'coordinator';
UPDATE slack_threads SET session_kind = 'foreman' WHERE session_kind = 'coordinator';

ALTER TABLE sessions ADD CONSTRAINT sessions_kind_check CHECK (kind IN ('foreman', 'worker'));
ALTER TABLE slack_threads ALTER COLUMN session_kind SET DEFAULT 'foreman';
ALTER TABLE slack_threads ADD CONSTRAINT slack_threads_session_kind_check CHECK (session_kind = 'foreman');
ALTER TABLE slack_threads ADD CONSTRAINT slack_threads_session_id_session_kind_fkey
  FOREIGN KEY (session_id, session_kind) REFERENCES sessions (id, kind);

-- migrate:down
ALTER TABLE slack_threads DROP CONSTRAINT slack_threads_session_id_session_kind_fkey;
ALTER TABLE slack_threads DROP CONSTRAINT slack_threads_session_kind_check;
ALTER TABLE sessions DROP CONSTRAINT sessions_kind_check;

UPDATE sessions SET kind = 'coordinator' WHERE kind = 'foreman';
UPDATE slack_threads SET session_kind = 'coordinator' WHERE session_kind = 'foreman';

ALTER TABLE sessions ADD CONSTRAINT sessions_kind_check CHECK (kind IN ('coordinator', 'worker'));
ALTER TABLE slack_threads ALTER COLUMN session_kind SET DEFAULT 'coordinator';
ALTER TABLE slack_threads ADD CONSTRAINT slack_threads_session_kind_check CHECK (session_kind = 'coordinator');
ALTER TABLE slack_threads ADD CONSTRAINT slack_threads_session_id_session_kind_fkey
  FOREIGN KEY (session_id, session_kind) REFERENCES sessions (id, kind);
