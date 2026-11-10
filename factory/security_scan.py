import hashlib
import html
import json
import os
import re
import subprocess
import tempfile
from dataclasses import asdict, dataclass
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from typing import Any, Literal, Optional

FACTORY_DIR = Path(__file__).resolve().parent
MAX_INPUT_BYTES = 512 * 1024
MAX_DIFF_BYTES = 256 * 1024
MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_CHANGED_BYTES = 32 * 1024 * 1024
CONTEXT_BYTES = 8 * 1024
MAX_FILES = 100
SEMGREP_VERSION = "1.144.0"
INVISIBLE = re.compile("[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]")
TEXT_RULES = {
    "hidden-markdown": re.compile(r"<!--[\s\S]*?-->", re.I),
    "concealed-html": re.compile(
        r"(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|"
        r"font-size\s*:\s*0|color\s*:\s*transparent|<[^>]+\bhidden\b)",
        re.I,
    ),
    "reviewer-instructions": re.compile(
        r"(?:ignore (?:all |any )?(?:previous|prior|above) instructions|"
        r"(?:reviewer|assistant|claude(?: code)?|factory agent)\s*[:,]|"
        r"(?:approve|merge) this (?:pr|pull request))",
        re.I,
    ),
    "encoded-blob": re.compile(r"(?:[A-Za-z0-9+/]{256,}={0,2}|\b[0-9a-fA-F]{256,}\b)"),
    "credential-access": re.compile(
        r"(?:gh\s+auth\s+token|~/\.(?:netrc|ssh)|169\.254\.169\.254|"
        r"\.git/config|/workspace/(?!phoenix))"
    ),
}
LOCKFILES = {"uv.lock", "pnpm-lock.yaml", "package-lock.json", "yarn.lock", "poetry.lock"}
MANIFESTS = {"pyproject.toml", "package.json", "requirements.txt", "requirements.in"}
BINARY_SUFFIXES = {
    ".avif",
    ".gif",
    ".ico",
    ".jpeg",
    ".jpg",
    ".pdf",
    ".png",
    ".webp",
    ".eot",
    ".otf",
    ".ttf",
    ".woff",
    ".woff2",
    ".mp3",
    ".mp4",
    ".ogg",
    ".wav",
    ".webm",
    ".gz",
    ".zip",
    ".parquet",
    ".arrow",
    ".sqlite",
    ".db",
}


@dataclass(frozen=True)
class Finding:
    path: str
    line: int
    rule: str
    excerpt: str
    source: Literal["static", "agent"] = "static"


class HiddenHTML(HTMLParser):
    def __init__(self, path: str) -> None:
        super().__init__(convert_charrefs=True)
        self.path = path
        self.findings: list[Finding] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        attributes = dict(attrs)
        style = attributes.get("style") or ""
        colors = dict(
            re.findall(r"(?:^|;)\s*(color|background(?:-color)?)\s*:\s*([^;]+)", style, re.I)
        )
        foreground = colors.get("color", "").strip().lower()
        background = colors.get("background-color", colors.get("background", "")).strip().lower()
        if "hidden" in attributes or (foreground and foreground == background):
            self.findings.append(
                Finding(
                    self.path,
                    self.getpos()[0],
                    "concealed-html",
                    ascii(self.get_starttag_text()[:160]),
                )
            )


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, ensure_ascii=True, separators=(",", ":")).encode()


def write_summary(text: str) -> None:
    safe = html.escape(text, quote=True)
    safe = "".join(f"\\u{ord(c):04x}" if ord(c) < 32 and c != "\n" else c for c in safe)
    safe = INVISIBLE.sub(lambda m: f"\\u{ord(m[0]):04x}", safe)
    if path := os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(path, "a") as output:
            output.write(f"<pre>{safe}</pre>\n")
    else:
        print(json.dumps({"factory_scan": text}, ensure_ascii=True))


def read_thread(*, number: int, kind: str) -> dict[str, Any]:
    from dispatch import run_gh

    root = "repos/{owner}/{repo}"
    issue = json.loads(run_gh("api", f"{root}/issues/{number}"))
    comments = json.loads(
        run_gh("api", "--paginate", "--slurp", f"{root}/issues/{number}/comments?per_page=100")
    )
    snapshot: dict[str, Any] = {
        "kind": kind,
        "number": number,
        "title": issue["title"],
        "body": issue["body"] or "",
        "user": {key: issue["user"][key] for key in ("login", "id", "type")},
        "author_association": issue["author_association"],
        "comments": sorted(
            [snapshot_comment(c) for page in comments for c in page],
            key=lambda c: c["id"],
        ),
    }
    if kind == "pr":
        for key, suffix in (("reviews", "reviews"), ("review_comments", "comments")):
            pages = json.loads(
                run_gh(
                    "api",
                    "--paginate",
                    "--slurp",
                    f"{root}/pulls/{number}/{suffix}?per_page=100",
                )
            )
            snapshot[key] = sorted(
                [snapshot_comment(c) for page in pages for c in page],
                key=lambda c: c["id"],
            )
    if len(canonical_json(snapshot)) > MAX_INPUT_BYTES:
        raise ValueError("too-large-to-scan: thread exceeds 512 KiB")
    return snapshot


def snapshot_comment(comment: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": comment["id"],
        "body": comment["body"] or "",
        "user": {key: (comment.get("user") or {}).get(key) for key in ("login", "id", "type")},
        **{
            key: comment[key]
            for key in (
                "author_association",
                "created_at",
                "updated_at",
                "state",
                "node_id",
                "path",
                "line",
                "original_line",
                "in_reply_to_id",
                "commit_id",
                "original_commit_id",
            )
            if key in comment
        },
    }


def text_findings(*, path: str, text: str) -> list[Finding]:
    findings = []
    for name, pattern in {**TEXT_RULES, "invisible-unicode": INVISIBLE}.items():
        for match in pattern.finditer(text):
            findings.append(
                Finding(
                    path,
                    text.count("\n", 0, match.start()) + 1,
                    name,
                    ascii(match[0][:160]),
                )
            )
    parser = HiddenHTML(path)
    parser.feed(text)
    parser.close()
    findings.extend(parser.findings)
    return findings


def git(*args: str, binary: bool = False) -> Any:
    result = subprocess.run(
        ["git", "--no-optional-locks", "-c", "core.hooksPath=/dev/null", *args],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
        timeout=120,
    ).stdout
    return result if binary else result.decode("utf-8", errors="backslashreplace").strip()


def added_ranges(diff: str) -> list[tuple[int, int]]:
    return [
        (int(m[1]), int(m[1]) + int(m[2] or 1))
        for m in re.finditer(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@", diff, re.M)
        if m[2] != "0"
    ]


def changed_line(line: int, end: int, ranges: list[tuple[int, int]]) -> bool:
    return any(line < stop and end >= start for start, stop in ranges)


def code_bundle(*, pr: dict[str, Any], destination: Path) -> tuple[dict[str, Any], list[Finding]]:
    sha, base_sha = pr["headRefOid"], pr["baseRefOid"]
    if not all(re.fullmatch(r"[0-9a-f]{40}", s) for s in (sha, base_sha)):
        raise ValueError("Invalid commit identity")
    fetch = ["fetch", "--quiet", "--no-tags", "--no-recurse-submodules"]
    if git("rev-parse", "--is-shallow-repository") == "true":
        fetch.append("--unshallow")
    git(*fetch, "origin", sha, base_sha)
    base = git("merge-base", base_sha, sha)
    diff = git("diff", "--text", "--no-ext-diff", "--no-textconv", "--no-color", base, sha, "--")
    if len(diff.encode()) > MAX_DIFF_BYTES:
        raise ValueError("too-large-to-scan: diff exceeds 256 KiB")
    entries = git("diff", "--name-status", "--no-renames", "-z", base, sha, "--", binary=True)
    tokens = entries.rstrip(b"\0").split(b"\0") if entries else []
    changes = {tokens[i + 1].decode(): tokens[i].decode() for i in range(0, len(tokens), 2)}
    if len(changes) > MAX_FILES:
        raise ValueError("too-large-to-scan: more than 100 changed files")
    paths = [p for p, status in changes.items() if status != "D"]
    for path in paths:
        parts = PurePosixPath(path)
        if parts.is_absolute() or ".." in parts.parts or not parts.parts:
            raise ValueError("Unsafe changed path")
    findings: list[Finding] = []
    ranges: dict[str, list[tuple[int, int]]] = {}
    if paths:
        entries = git("ls-tree", "-r", "-l", "-z", "--full-tree", sha, "--", *paths, binary=True)
        total_bytes = 0
        for entry in entries.rstrip(b"\0").split(b"\0"):
            metadata, raw_path = entry.split(b"\t", 1)
            mode, kind, oid, size = metadata.split()
            path = raw_path.decode("utf-8")
            if path not in paths or kind != b"blob" or mode not in (b"100644", b"100755"):
                raise ValueError(
                    "Unsupported changed entry: links and special files are not admitted"
                )
            num_bytes = int(size)
            if num_bytes > MAX_FILE_BYTES:
                raise ValueError("too-large-to-scan: changed file exceeds 8 MiB")
            total_bytes += num_bytes
            if total_bytes > MAX_CHANGED_BYTES:
                raise ValueError("too-large-to-scan: changed files exceed 32 MiB")
            target = destination / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(git("cat-file", "blob", oid.decode("ascii"), binary=True))
    context = []
    names = {PurePosixPath(p).name for p in changes}
    for path in paths:
        target = destination / path
        if not target.is_file():
            raise ValueError("Unsupported changed entry (including submodules)")
        raw = target.read_bytes()
        if b"\0" in raw:
            if target.suffix.lower() not in BINARY_SUFFIXES:
                raise ValueError(f"uninspectable-file: {path} contains NUL bytes in a text file")
            findings.append(Finding(path, 1, "binary-content", "File contains NUL bytes"))
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            findings.append(Finding(path, 1, "non-utf8-file", "Invalid bytes escaped as \\xNN"))
            text = raw.decode("utf-8", errors="backslashreplace")
        patch = git(
            "diff", "--text", "--no-ext-diff", "--no-textconv", "--unified=0", base, sha, "--", path
        )
        ranges[path] = added_ranges(patch)
        findings.extend(
            f
            for f in text_findings(path=path, text=text)
            if changed_line(f.line, f.line, ranges[path])
        )
        name = target.name
        if name in {
            "conftest.py",
            "setup.py",
            "sitecustomize.py",
            ".npmrc",
            ".pypirc",
            ".pre-commit-config.yaml",
            ".pre-commit-config.yml",
            "Makefile",
        } or name.endswith(".pth"):
            findings.append(
                Finding(path, 1, "automatic-execution-config", "Changed test/build/install hook")
            )
        if name == "package.json":
            data = json.loads(text)
            for key, value in data.get("scripts", {}).items():
                if key in {
                    "preinstall",
                    "install",
                    "postinstall",
                    "prepare",
                    "prepublish",
                    "prepack",
                    "postpack",
                }:
                    findings.append(Finding(path, 1, "lifecycle-script", f"{key}: {value}"[:200]))
        if name == "pyproject.toml" and re.search(
            r"build-system|build-backend|backend-path|build\.hooks", patch
        ):
            findings.append(Finding(path, 1, "build-hook", "Build backend or hook changed"))
        if name in LOCKFILES:
            if not names.intersection(MANIFESTS):
                findings.append(
                    Finding(path, 1, "lockfile-without-manifest", "No matching manifest changed")
                )
            for number, line in enumerate(text.splitlines(), 1):
                if "http" in line and changed_line(number, number, ranges[path]):
                    findings.append(Finding(path, number, "lockfile-registry-url", line[:200]))
        start = max(0, (ranges[path][0][0] if ranges[path] else 1) - 12)
        snippet = (
            "\n".join(text.splitlines()[start:]).encode()[:CONTEXT_BYTES].decode(errors="replace")
        )
        context.append(
            {
                "path": path,
                "first_line": start + 1,
                "context": snippet,
                "context_truncated": len(snippet.encode()) < len(raw),
            }
        )
    if paths:
        findings.extend(semgrep_findings(destination=destination, paths=paths, ranges=ranges))
    return {
        "sha": sha,
        "base_sha": base_sha,
        "merge_base": base,
        "diff": diff,
        "files": context,
        "commit_messages": git("log", "--format=%B", f"{base}..{sha}"),
    }, findings


def semgrep_findings(
    *, destination: Path, paths: list[str], ranges: dict[str, list[tuple[int, int]]]
) -> list[Finding]:
    with tempfile.TemporaryDirectory(prefix="factory-semgrep-") as home:
        env = {key: os.environ[key] for key in ("PATH", "LANG") if key in os.environ}
        env.update(HOME=home, SEMGREP_SEND_METRICS="off", SEMGREP_ENABLE_VERSION_CHECK="0")
        executable = os.environ.get("FACTORY_SEMGREP", "semgrep")
        version = subprocess.run(
            [executable, "--version"],
            cwd=home,
            env=env,
            capture_output=True,
            text=True,
            check=True,
            timeout=30,
        ).stdout.strip()
        if version != SEMGREP_VERSION:
            raise ValueError("The pinned Semgrep version is not installed")
        result = subprocess.run(
            [
                executable,
                "scan",
                "--json",
                "--strict",
                "--metrics=off",
                "--disable-version-check",
                "--disable-nosem",
                "--no-git-ignore",
                "--scan-unknown-extensions",
                "--x-semgrepignore-filename",
                f".{Path(home).name}-ignore",
                "--config",
                str(FACTORY_DIR / "security_rules.yml"),
                "--timeout",
                "10",
                "--max-target-bytes",
                str(MAX_FILE_BYTES),
                *[str(destination / p) for p in paths],
            ],
            cwd=home,
            env=env,
            capture_output=True,
            text=True,
            timeout=120,
            check=True,
        )
    output = json.loads(result.stdout)
    if output.get("errors"):
        raise ValueError("Semgrep could not completely inspect the changed files")
    findings = []
    for hit in output["results"]:
        path = str(Path(hit["path"]).relative_to(destination))
        line = hit["start"]["line"]
        if changed_line(line, hit["end"]["line"], ranges.get(path, [])):
            findings.append(Finding(path, line, hit["check_id"], hit["extra"]["message"]))
    return findings


def find_admission_problem(
    *,
    number: int,
    kind: str,
    pr: Optional[dict[str, Any]] = None,
    snapshot: Optional[dict[str, Any]] = None,
    subject: Optional[dict[str, Any]] = None,
) -> Optional[str]:
    from security_scan_agent import scan

    try:
        snapshot = snapshot if snapshot is not None else read_thread(number=number, kind=kind)
        if pr is not None:
            snapshot["head_ref"] = pr["headRefName"]
            snapshot["base_ref"] = pr["baseRefName"]
        if subject is not None:
            subject["_factory_snapshot"] = snapshot
        elif pr is not None:
            pr["_factory_snapshot"] = snapshot
            pr["title"], pr["body"] = snapshot["title"], snapshot["body"]
        findings = []
        for key in ("title", "body"):
            findings.extend(text_findings(path=f"{kind}#{number}/{key}", text=snapshot[key]))
        for key in ("comments", "reviews", "review_comments"):
            for comment in snapshot.get(key, []):
                findings.extend(
                    text_findings(
                        path=f"{kind}#{number}/{key}/{comment['id']}", text=comment["body"]
                    )
                )
        with tempfile.TemporaryDirectory(prefix="factory-scan-") as directory:
            destination = Path(directory) / "files"
            destination.mkdir()
            code, code_findings = code_bundle(pr=pr, destination=destination) if pr else ({}, [])
            findings.extend(code_findings)
            bundle = canonical_json(
                {"thread": snapshot, "code": code, "static_findings": [asdict(f) for f in findings]}
            )
            if len(bundle) > MAX_INPUT_BYTES:
                raise ValueError("too-large-to-scan: combined input exceeds 512 KiB")
            lock = json.loads((FACTORY_DIR / "claude-lock.json").read_text())
            policy = b"".join(
                (FACTORY_DIR / p).read_bytes()
                for p in (
                    "security_scan.py",
                    "security_scan_agent.py",
                    "security_rules.yml",
                    "agents/admission-scanner.md",
                    "environments/security-scan.yaml",
                )
            )
            fingerprint = hashlib.sha256(bundle + policy + canonical_json(lock)).hexdigest()
            cache_dir = os.environ.get("FACTORY_SCAN_CACHE_DIR")
            cache = Path(cache_dir) / f"{fingerprint}.json" if cache_dir else None
            if cache is not None and cache.is_file():
                from security_scan_agent import parse_verdict

                verdict = parse_verdict(cache.read_text())
                write_summary(f"Admission scan cache hit: {fingerprint}")
            else:
                verdict = scan(bundle=bundle, lock=lock)
                if cache is not None:
                    cache.parent.mkdir(parents=True, exist_ok=True)
                    cache.write_bytes(canonical_json(verdict))
            write_summary(
                f"Admission scan {kind}#{number}, SHA {code.get('sha', 'n/a')}, "
                f"input {fingerprint}: {verdict['verdict']}\n{verdict['reason']}"
            )
            for finding in findings:
                write_summary(json.dumps(asdict(finding), ensure_ascii=True))
            if verdict["verdict"] == "fail":
                write_summary(
                    json.dumps(
                        asdict(
                            Finding(
                                f"{kind}#{number}",
                                1,
                                "hostile-toward-factory",
                                verdict["reason"],
                                "agent",
                            )
                        )
                    )
                )
                return "the security scan rejected the input; see the workflow step summary"
            return None
    except Exception as error:
        if str(error).startswith("uninspectable-file:"):
            write_summary(str(error))
            return (
                "the input contains a text file with NUL bytes; "
                "remove them (see the workflow summary)"
            )
        if str(error).startswith("too-large-to-scan"):
            write_summary(
                json.dumps(
                    asdict(
                        Finding(
                            f"{kind}#{number}",
                            1,
                            "too-large-to-scan",
                            str(error),
                        )
                    )
                )
            )
            return (
                "the input exceeds security scan limits; split or reduce it "
                "(see the workflow summary)"
            )
        write_summary(
            f"Admission scan unavailable ({type(error).__name__}): {str(error)[:300]}; "
            "no session admitted"
        )
        return "the security scan could not complete; see the workflow run and retry"
