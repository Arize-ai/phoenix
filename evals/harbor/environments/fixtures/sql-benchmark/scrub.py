"""Remove credentials and personal data from a Phoenix SQLite fixture in place.

The fixture is a development database whose agent traces recorded shell output,
so API keys, tokens, and the developers' emails and home directories appear
inside span attributes and other free text. This script deletes the tables that
hold credentials outright, removes the coding-agent projects whose traces record
developers' shell sessions and source code, replaces every token-shaped string
with a marker, pseudonymizes personal emails, and generalizes home directory
paths, then compacts the file. Run it as ``python3 scrub.py path/to/phoenix.db``.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import sys
from pathlib import Path

CREDENTIAL_TABLES = (
    "secrets",
    "api_keys",
    "access_tokens",
    "refresh_tokens",
    "password_reset_tokens",
    "oauth2_authorization_codes",
    "oauth2_grants",
    "oauth2_clients",
    "agent_session_snapshots",
    "agent_session_messages",
    "agent_sessions",
    "generative_model_custom_providers",
)

# Projects whose traces are recordings of developers' coding-agent sessions. Deleting
# a project cascades to its sessions, traces, spans, costs, and annotations.
EXCLUDED_PROJECTS = ("claude-code", "pi")

# Token shapes and the marker that replaces each. The marker keeps the prefix so a
# reader can still tell what kind of value stood there.
TOKENS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"sk-ant-[A-Za-z0-9_-]{24,}"), "sk-ant-REDACTED"),
    (re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}"), "sk-REDACTED"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "AKIAREDACTED"),
    (re.compile(r"\bghp_[A-Za-z0-9]{36}\b"), "ghp_REDACTED"),
    (re.compile(r"\bgithub_pat_[A-Za-z0-9_]{40,}"), "github_pat_REDACTED"),
    (re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}"), "xoxb-REDACTED"),
    (re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"), "AIzaREDACTED"),
    (
        re.compile(r"\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}"),
        "eyJ.REDACTED",
    ),
    (re.compile(r"\bpxe[A-Za-z0-9_-]{20,}"), "pxeREDACTED"),
    (re.compile(r"(Bearer\s+)[A-Za-z0-9._~+/=-]{24,}"), r"\1REDACTED"),
    (
        re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"),
        "REDACTED_PRIVATE_KEY",
    ),
]

# The lookbehind keeps a match from starting on the letter of an escape such as the
# ``\t`` left inside doubly encoded JSON, which would otherwise be consumed with the email.
EMAIL = re.compile(r"(?<!\\)\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b")
PUBLIC_EMAILS = {"oss@arize.com"}
PERSONAL_DOMAINS = {
    "arize.com",
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "icloud.com",
    "me.com",
    "proton.me",
    "protonmail.com",
}
HOME_DIR = re.compile(r"(/Users/|/home/)(?!(?:user|agent|runner|Shared|USER)/)([A-Za-z0-9._-]+)/")


def pseudonym(email: str) -> str:
    digest = hashlib.sha1(email.lower().encode()).hexdigest()[:6]
    return f"user-{digest}@example.com"


def scrub_email(match: re.Match[str]) -> str:
    email = match.group(0)
    if email.lower() in PUBLIC_EMAILS or match.group(2).lower() not in PERSONAL_DOMAINS:
        return email
    return pseudonym(email)


def scrub_text(text: str) -> str:
    for pattern, replacement in TOKENS:
        text = pattern.sub(replacement, text)
    text = EMAIL.sub(scrub_email, text)
    return HOME_DIR.sub(r"\1user/", text)


def scrub_json(value: object) -> object:
    if isinstance(value, str):
        return scrub_text(value)
    if isinstance(value, list):
        return [scrub_json(item) for item in value]
    if isinstance(value, dict):
        return {scrub_text(key): scrub_json(item) for key, item in value.items()}
    return value


def scrub_value(text: str) -> str:
    """Scrub a column value, descending into JSON documents so that patterns see
    decoded strings: matching the serialized text would let an email swallow the
    letter of a preceding escape such as ``\\t`` and leave the document malformed.
    Rewritten documents use the compact separators Phoenix writes."""
    try:
        document = json.loads(text)
    except ValueError:
        return scrub_text(text)
    if not isinstance(document, (dict, list)):
        return scrub_text(text)
    scrubbed = scrub_json(document)
    if scrubbed == document:
        return text
    return json.dumps(scrubbed, ensure_ascii=False, separators=(",", ":"))


def text_columns(db: sqlite3.Connection, table: str) -> list[str]:
    columns = db.execute(f'pragma table_info("{table}")').fetchall()
    return [name for _, name, kind, *_ in columns if "BLOB" not in kind.upper()]


def scrub_table(db: sqlite3.Connection, table: str) -> int:
    columns = text_columns(db, table)
    if not columns:
        return 0
    select = ", ".join(f'"{c}"' for c in columns)
    changed = 0
    for row in db.execute(f'select rowid, {select} from "{table}"').fetchall():
        rowid, *values = row
        updates = {
            column: scrubbed
            for column, value in zip(columns, values)
            if isinstance(value, str) and (scrubbed := scrub_value(value)) != value
        }
        if updates:
            assignments = ", ".join(f'"{c}" = ?' for c in updates)
            db.execute(
                f'update "{table}" set {assignments} where rowid = ?', [*updates.values(), rowid]
            )
            changed += 1
    return changed


# Accounts at these domains are built in or already pseudonymous, so scrubbing twice
# yields the same usernames.
KEPT_ACCOUNT_DOMAINS = ("localhost", "example.com")


def account_email(username: str, email: str | None) -> str:
    """Pseudonymize every account that is not built in. An account without an email, which
    LDAP allows, gets one derived from its username so that the identity-provider columns
    can be cleared without leaving it unidentifiable."""
    if email is None:
        return pseudonym(username)
    if email.lower() in PUBLIC_EMAILS or email.lower().endswith(
        tuple("@" + domain for domain in KEPT_ACCOUNT_DOMAINS)
    ):
        return email
    return pseudonym(email)


def scrub_users(db: sqlite3.Connection) -> None:
    """Keep the accounts, since experiments and datasets point at them, but make the
    stored credentials unusable, the emails and usernames pseudonymous, and drop the
    avatar and identity-provider ids that tie an account to a real person. Only LOCAL
    accounts may carry a password, so only they receive a new random one."""
    for user_id, username, email in db.execute("select id, username, email from users").fetchall():
        new_email = account_email(username, email)
        db.execute(
            "update users set username = ?, email = ?,"
            " password_hash = case when auth_method = 'LOCAL' then ? end,"
            " password_salt = case when auth_method = 'LOCAL' then ? end,"
            " profile_picture_url = null, oauth2_client_id = null, oauth2_user_id = null,"
            " ldap_unique_id = null where id = ?",
            (new_email.split("@")[0], new_email, os.urandom(32), os.urandom(32), user_id),
        )


def main(path: Path) -> None:
    db = sqlite3.connect(path)
    db.execute("pragma foreign_keys = on")
    with db:
        existing = {
            name for (name,) in db.execute("select name from sqlite_master where type = 'table'")
        }
        for table in CREDENTIAL_TABLES:
            if table in existing:
                db.execute(f'delete from "{table}"')
        for project in EXCLUDED_PROJECTS:
            db.execute("delete from projects where name = ?", (project,))
        scrub_users(db)
        tables = [
            name
            for name in sorted(existing)
            if name not in CREDENTIAL_TABLES and name not in {"users", "alembic_version"}
        ]
        for table in tables:
            changed = scrub_table(db, table)
            if changed:
                print(f"{table}: rewrote {changed} rows")
    db.execute("vacuum")
    (integrity,) = db.execute("pragma integrity_check").fetchone()
    violations = db.execute("pragma foreign_key_check").fetchall()
    db.close()
    if integrity != "ok" or violations:
        raise SystemExit(f"scrub left the database inconsistent: {integrity}, {violations}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
