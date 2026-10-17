# Booting With Auth Enabled and No Secret

> **Status: proposed.** Tracks [#13959](https://github.com/Arize-ai/phoenix/issues/13959).

## Summary

`PHOENIX_ENABLE_AUTH=true` without `PHOENIX_SECRET` crashes at startup today.
This spec makes that configuration boot by generating a secret when none is
supplied. The generated secret is saved to the working directory when the disk
allows it and held in memory otherwise. An explicit `PHOENIX_SECRET` always
wins, so no existing deployment changes behavior.

The result is Grafana-shaped: an operator who never thinks about the signing key
gets a working, login-protected server. An operator who does think about it sets
`PHOENIX_SECRET` and gets the durable deployment Phoenix offers today. There is
one rule for the in-between case, and it is stated at every boot: **without a
secret you supplied or a disk we can write to, nothing survives a restart.**

## Goals

- Auth enabled with no `PHOENIX_SECRET` boots instead of raising.
- The generated secret is unique per installation.
- The generated secret survives restarts whenever the working directory is
  writable, and the server says clearly what is lost when it is not.
- Enabling auth on a database that already holds saved credentials does not
  strand them.
- Zero change for any deployment that sets `PHOENIX_SECRET`.

## Non-Goals

- Changing the default of `PHOENIX_ENABLE_AUTH` anywhere, including the Docker
  image. Separate decision on the issue thread.
- A generated admin password. Same.
- Helm chart changes. The chart already generates a `PHOENIX_SECRET` into a
  Kubernetes Secret, so server-side generation never fires under Helm. Its
  rotate-on-upgrade bug is real but independent.
- Storing the secret in the application database. See Security.
- Coordinating a generated secret across replicas.
- A second encryption mode for the ephemeral case. Considered and rejected; see
  Design.
- Secret rotation tooling.

## Background

### Where the crash is

`get_env_auth_settings()` in `src/phoenix/config.py` raises when
`get_env_enable_auth()` is true and `get_env_phoenix_secret()` is empty.
`serve.py` calls it once at startup and passes the result to `create_app`, which
hands the secret to the JWT store and to `EncryptionService`.

### The secret has two consumers

`PHOENIX_SECRET` signs JWTs and is the sole confidential input to the Fernet key
that encrypts rows in `secrets` and `generative_model_custom_providers`
(`src/phoenix/server/encryption.py`). The KDF salt and iteration count are public.
Changing the secret therefore does two things: it logs every user out, and it
makes every encrypted row unreadable. The first is an inconvenience. The second
is data loss.

### The no-secret key is public

With no secret, `EncryptionService` derives its key from the empty string. That
key is derivable by anyone, so the encryption provides no at-rest protection in
that mode. It also means Phoenix can always decrypt data written under it, which
the re-encryption step below relies on.

### The disk is often not writable

The Docker image runs as a nonroot user on a distroless base. The Helm chart
defaults to `readOnlyRootFilesystem: true` and mounts an emptyDir at the working
directory when persistence is off. Cloud Run, Render, and Railway containers are
similar. A file in the working directory is a good place to keep a generated
secret for `docker run -v` and local `phoenix serve`, and an unreliable one
everywhere else.

## Design

### Resolution order

Nothing here runs when auth is disabled. With auth off the server neither reads
nor writes the secret file, exactly as today.

When auth is enabled, `get_env_auth_settings()` resolves the secret as follows:

1. **`PHOENIX_SECRET` from the environment.** Wins unconditionally. Unchanged.
2. **`<PHOENIX_WORKING_DIR>/secret`**, if it exists. Its contents are stripped
   and validated against `REQUIREMENTS_FOR_PHOENIX_SECRET`. A file that exists
   but fails validation is a **hard error**, not a fallthrough: regenerating over
   a corrupt file would strand every row encrypted under the old value. The
   error names the path and says to restore it or set `PHOENIX_SECRET`.
3. **Generate.** Produce `secrets.token_urlsafe(48)` in a loop until it passes
   `REQUIREMENTS_FOR_PHOENIX_SECRET`. The requirements demand a digit and a
   lowercase letter, and a 64-character url-safe token lacks one of those with
   probability around one in fifty thousand, so the loop is not decorative.
   Then attempt to write it:
   - `mkdir -p` the working directory.
   - Open the target with `O_CREAT | O_EXCL | O_WRONLY` and mode `0600`. If the
     open fails with `EEXIST`, another process won the race; go back to step 2.
   - Write, fsync, close.
   - Any other `OSError` (read-only filesystem, permission denied, missing
     parent that could not be created) is caught, logged, and the secret is kept
     in memory for the life of the process.

The file lives in the working directory because for the default SQLite
deployment that gives the secret and the data the same lifetime. Losing one
without the other is worse than losing both.

The resolved secret is used for both JWT signing and encryption, exactly as an
operator-supplied secret is. There is no special encryption path for generated
or ephemeral secrets. One alternative was considered: fall back to the
empty-string encryption key when the secret is ephemeral so saved credentials
survive restarts. It was rejected because it creates a mode where at-rest
encryption is silently off, adds a source-tracking concept to `AuthSettings`
and `EncryptionService`, and replaces one easy rule with two. The cost of the
rejected trade is borne only by deployments with no secret, no writable disk,
and an external database, and for them the fix is one environment variable.

### What the user sees

The generated secret's value is never printed. Users who care set
`PHOENIX_SECRET`; users who do not should not have a signing key scroll past in
`docker logs`. There is no way to recall a value from a log aggregator.

Phoenix already prints a boot message with the UI URL and a few status lines.
The ephemeral-secret notice goes **in that boot message**, not only in the
logger, because the logger's WARNING level is the first thing operators filter
and the boot message is the one thing they read.

| Situation | Where | Text |
|---|---|---|
| File newly written | logger INFO | `PHOENIX_SECRET is not set. Generated one and saved it to <path>.` |
| File loaded | logger INFO | `Using generated PHOENIX_SECRET from <path>.` |
| Ephemeral | boot message and logger WARNING, every boot | `PHOENIX_SECRET is not set and <path> is not writable, so a temporary secret is in use. On restart, all users are logged out and any API keys saved in the playground are lost. Set PHOENIX_SECRET to fix this.` |

The ephemeral notice repeats on every boot rather than once because the
operator most likely to hit it is the one who never read the first boot's logs,
and because every boot in that state has just discarded the previous secret.

### Re-encryption from the empty key

This is the only part of the design that writes to the database, and it exists
to fix a hazard this spec would otherwise widen: run without auth, save an
OpenAI key in the playground, enable auth. Today the key is encrypted under the
empty-string Fernet key and becomes unreadable the moment a real secret is
configured. This spec creates a new, easy way to configure a real secret, so it
has to close that hole.

On startup, after migrations, as a `Facilitator` step, when auth is enabled and
the server is not in `--read-only` mode:

1. Derive the empty-string Fernet key once (PBKDF2 at 600k iterations is
   roughly 0.3s; doing it per row would be a mistake).
2. For each row in `secrets` and `generative_model_custom_providers`, attempt
   to decrypt with the configured key. On `InvalidToken`, attempt the
   empty-string key. Rows that decrypt under the empty-string key are
   re-encrypted under the configured key and written back in one transaction.
   Rows that decrypt under neither are left untouched and counted.
3. If the count from step 2 is non-zero, log a WARNING: `<n> stored credentials
   cannot be decrypted with the current PHOENIX_SECRET. They were encrypted
   under a secret that is no longer available and must be re-entered.`

Properties: idempotent, a no-op on any database that has only ever had one
secret, safe under concurrent replicas (both derive the same key and write
equivalent ciphertext, and both tables are small), and skipped in read-only
mode. It lives in the facilitator rather than Alembic because it depends on
runtime configuration, not schema.

This step also runs when the secret came from the environment. That is a
behavior change for existing deployments, but strictly a repair: rows that are
unreadable today become readable. There is no path by which it makes a readable
row unreadable.

### `PHOENIX_ADMIN_SECRET`

Today this must not be set without `PHOENIX_SECRET`, and must differ from it.
Both checks run against the resolved secret. A generated secret counts as
configured.

## Security

**Why not the database.** An earlier proposal on the issue stored the generated
secret in a config table. Against a leaked backup or a DB-only compromise the
attacker then holds the ciphertext and the only confidential KDF input in the
same file, and the encryption protects nothing. That is strictly weaker than any
deployment that supplies the secret out of band. A `0600` file in the working
directory keeps key and ciphertext apart, which is the property the encryption
module exists to provide.

**Why not print the value.** Container stdout is routinely shipped to log
aggregators. A secret printed once at generation exists in one more place than
the file, forever. The operator who wants to know the secret can set it; the
operator who does not want to know it should not have it logged.

**Uniqueness.** Every installation without `PHOENIX_SECRET` gets a distinct
signing key. This improves on the Grafana model, where the default key is a
constant shared by every instance that never changed it.

**Fail-fast is gone.** Some operators rely on "auth on without a secret crashes"
as a guard against a misconfigured deploy. After this change the deploy comes up
with a WARNING instead. Accepted: the Helm chart always supplies a secret, and
outside Helm the operator who wants fail-fast is the operator who already sets
`PHOENIX_SECRET`.

## Compatibility

| Deployment | Before | After |
|---|---|---|
| `PHOENIX_SECRET` set | Works | Unchanged, plus re-encryption repair of any empty-key rows |
| Auth off | Works, empty-string encryption key | Unchanged. Secret file is neither read nor written. |
| Auth on, no secret, writable working dir | Crash | Boots. Secret in `<working_dir>/secret`, mode `0600`. Survives restart. |
| Auth on, no secret, read-only working dir | Crash | Boots. Secret in memory. Restart logs users out and loses saved playground keys. Notice in boot message every time. |
| Auth off with saved playground keys, then auth on | Keys unreadable | Keys re-encrypted on first boot |

Nothing in this spec changes a configuration that works today, except to repair
rows that are currently unreadable.

## User journeys

These are the cases the docs and the boot message have to serve.

- **Trying auth locally.** `PHOENIX_ENABLE_AUTH=true phoenix serve`. Boots,
  writes `~/.phoenix/secret`, login works, sessions survive a restart. Nothing
  to configure.
- **Docker with a volume.** `docker run -e PHOENIX_ENABLE_AUTH=true -v
  phoenix:/data …`. Same as above with `/data/secret`. The secret and the
  SQLite file share the volume and share a fate.
- **Docker without a volume.** Container filesystem is writable, so the secret
  persists across `docker restart` and vanishes with `docker rm`, exactly like
  the database does.
- **Cloud Run, Render, Railway with Postgres and no secret.** Boots. Boot
  message says a temporary secret is in use and what that costs. Operator adds
  `PHOENIX_SECRET` in the platform's env settings and redeploys. Any keys saved
  before that are gone, and the boot message told them so before they saved any.
- **Helm.** Chart-generated secret in a Kubernetes Secret. This spec never
  activates.

## Rollout

One PR touching `src/phoenix/config.py`, `src/phoenix/db/facilitator.py`, the
boot message in `src/phoenix/server/cli/commands/serve.py`, the `PHOENIX_SECRET`
docstring in `config.py`, and a "Running without a secret" subsection in
`docs/phoenix/self-hosting/features/authentication.mdx` that walks the user
journeys above.

Tests:

- Auth on, no secret, writable temp working dir: boots, file exists with mode
  `0600`, second boot loads the same value, no second file write.
- Auth on, no secret, read-only working dir: boots, WARNING emitted, boot
  message contains the notice.
- File exists with invalid content: startup raises, error names the path.
- Two concurrent resolvers against an empty working dir: both end with the same
  secret.
- Re-encryption: seed a row under the empty key, boot with a secret, row
  decrypts under the new key; boot again, zero writes. Seed a row under an
  unrelated key: untouched, WARNING count is one.
- Re-encryption skipped under `--read-only`.
- `PHOENIX_ADMIN_SECRET` accepted alongside a generated secret.

## Follow-ups (out of scope)

- Default `PHOENIX_ENABLE_AUTH=true` in the Docker image, staged behind a
  warning release.
- A generated bootstrap admin password, printed once, Jenkins style.
- Helm chart: wrap generated values in `lookup` so `helm upgrade` stops rotating
  `PHOENIX_SECRET`, and add `helm.sh/resource-policy: keep` to the Secret.
- `phoenix serve --auth` as sugar for `PHOENIX_ENABLE_AUTH=true`.
- `PHOENIX_SECRET_FILE` for Docker and Kubernetes secret mounts, matching the
  `GF_*__FILE` convention.
- A banner in playground settings when the secret is ephemeral, if the
  Cloud-Run-without-a-secret population turns out to be real.
