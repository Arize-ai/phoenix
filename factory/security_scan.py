import base64
import hashlib
import html
import json
import os
import re
import subprocess
import tempfile
from dataclasses import asdict, dataclass, field
from difflib import unified_diff
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from typing import Any, Literal, Optional, Sequence, TypedDict, cast

import anthropic

FACTORY_DIR = Path(__file__).resolve().parent
POLICY_FILES = ("security_scan.py", "security_rules.yml", "security_scan_prompt.md")
MODEL = "claude-opus-5-5"
EFFORT = "medium"
MAX_TOKENS = 8192
TIMEOUT_SECONDS = 300
MAX_IMAGES = 20
MAX_IMAGE_BYTES = 7 * 1024 * 1024
MAX_TOTAL_IMAGE_BYTES = 16 * 1024 * 1024
VERDICT_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["pass", "fail"]},
        "reason": {"type": "string"},
    },
    "required": ["verdict", "reason"],
    "additionalProperties": False,
}
MAX_INPUT_BYTES = 512 * 1024
MAX_DIFF_BYTES = 256 * 1024
MAX_FILE_BYTES = 8 * 1024 * 1024
MAX_CHANGED_BYTES = 32 * 1024 * 1024
CONTEXT_BYTES = 8 * 1024
MAX_IMAGE_TEXT_BYTES = 128 * 1024
MAX_FILES = 100
SEMGREP_VERSION = "1.144.0"
INVISIBLE = re.compile(
    "[\u00ad\u034f\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f"
    "\u3164\ufe00-\ufe0f\ufeff\uffa0\U000e0000-\U000e007f\U000e0100-\U000e01ef]"
)
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


@dataclass(frozen=True)
class GitBlob:
    oid: str
    mode: str
    data: bytes


ImageMediaType = Literal["image/jpeg", "image/png", "image/gif", "image/webp"]
Revision = Literal["before", "after"]


@dataclass(frozen=True)
class ScanImage:
    path: str
    revision: Revision
    media_type: ImageMediaType
    blob_oid: str
    data: bytes

    def metadata(self) -> dict[str, Any]:
        return {
            "path": self.path,
            "revision": self.revision,
            "media_type": self.media_type,
            "blob_oid": self.blob_oid,
            "size_bytes": len(self.data),
        }


@dataclass(frozen=True)
class ImageText:
    path: str
    revision: Revision
    readable_text: str


@dataclass(frozen=True)
class FileContext:
    path: str
    first_line: int
    context: str
    context_truncated: bool


@dataclass(frozen=True)
class CodeBundle:
    sha: str
    base_sha: str
    merge_base: str
    diff: str
    files: list[FileContext]
    images: list[ScanImage]
    image_text: list[ImageText]
    commit_messages: str

    def serialize(self) -> dict[str, Any]:
        return {
            "sha": self.sha,
            "base_sha": self.base_sha,
            "merge_base": self.merge_base,
            "diff": self.diff,
            "files": [asdict(f) for f in self.files],
            "images": [image.metadata() for image in self.images],
            "image_text": [asdict(t) for t in self.image_text],
            "commit_messages": self.commit_messages,
        }


class SnapshotUser(TypedDict):
    login: Optional[str]
    id: Optional[int]
    type: Optional[str]


class SnapshotComment(TypedDict, total=False):
    id: int
    body: str
    user: SnapshotUser
    author_association: str
    created_at: str
    updated_at: str
    state: str
    node_id: str
    path: str
    line: Optional[int]
    original_line: Optional[int]
    in_reply_to_id: int
    commit_id: str
    original_commit_id: str


class ThreadSnapshot(TypedDict, total=False):
    kind: str
    number: int
    title: str
    body: str
    user: SnapshotUser
    author_association: str
    comments: list[SnapshotComment]
    reviews: list[SnapshotComment]
    review_comments: list[SnapshotComment]
    head_ref: str
    base_ref: str


CommentKey = Literal["comments", "reviews", "review_comments"]


@dataclass(frozen=True)
class ScanInput:
    """What the admission model judges: the frozen thread, the admitted code and the static
    evidence found in both. Serialized only for the cache fingerprint and the API request."""

    thread: ThreadSnapshot
    code: Optional[CodeBundle]
    static_findings: list[Finding] = field(default_factory=list)

    @property
    def images(self) -> list[ScanImage]:
        return self.code.images if self.code is not None else []

    def serialize(self) -> bytes:
        return canonical_json(
            {
                "thread": self.thread,
                "code": self.code.serialize() if self.code is not None else {},
                "static_findings": [asdict(f) for f in self.static_findings],
            }
        )


@dataclass(frozen=True)
class Verdict:
    verdict: Literal["pass", "fail"]
    reason: str


def validate_images(images: Sequence[ScanImage]) -> None:
    if len(images) > MAX_IMAGES:
        raise ValueError("too-large-to-scan: more than 20 image versions")
    if any(len(image.data) > MAX_IMAGE_BYTES for image in images):
        raise ValueError("too-large-to-scan: image exceeds 7 MiB")
    if sum(len(image.data) for image in images) > MAX_TOTAL_IMAGE_BYTES:
        raise ValueError("too-large-to-scan: image content exceeds 16 MiB")


def read_blob(*, revision: str, path: str) -> Optional[GitBlob]:
    entry = git("ls-tree", "-l", "-z", revision, "--", path, binary=True)
    if not entry:
        return None
    metadata, raw_path = entry.rstrip(b"\0").split(b"\t", 1)
    mode, kind, oid, size = metadata.split()
    if raw_path.decode("utf-8") != path or kind != b"blob":
        raise ValueError("Unsupported changed entry (including submodules)")
    if int(size) > MAX_FILE_BYTES:
        raise ValueError("too-large-to-scan: changed file exceeds 8 MiB")
    return GitBlob(
        oid.decode("ascii"),
        mode.decode("ascii"),
        git("cat-file", "blob", oid.decode("ascii"), binary=True),
    )


def image_type(data: bytes, *, path: str) -> Optional[ImageMediaType]:
    suffix = PurePosixPath(path).suffix.lower()
    if suffix == ".png" and data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if suffix in (".jpg", ".jpeg") and data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if suffix == ".gif" and data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if suffix == ".webp" and data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def image_text(data: bytes) -> str:
    text = "\n".join(
        re.findall(r"[^\x00-\x1f\x7f-\x9f\ufffd]{4,}", data.decode("utf-8", errors="replace"))
    )
    if len(text.encode()) > MAX_IMAGE_TEXT_BYTES:
        raise ValueError("too-large-to-scan: readable image text exceeds 128 KiB")
    return text


def image_diff(*, path: str, before: Optional[GitBlob], after: Optional[GitBlob]) -> str:
    def lines(blob: Optional[GitBlob]) -> list[str]:
        if blob is None:
            return []
        if media_type := image_type(blob.data, path=path):
            return [f"[Image supplied visually: {media_type}, blob {blob.oid}]\n"]
        return blob.data.decode("utf-8", errors="backslashreplace").splitlines(keepends=True)

    header = (
        f"diff --git {path!r} {path!r}\n"
        f"before mode: {before.mode if before else 'absent'}\n"
        f"after mode: {after.mode if after else 'absent'}\n"
    )
    return header + "".join(
        unified_diff(lines(before), lines(after), fromfile=f"a/{path}", tofile=f"b/{path}", n=0)
    )


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


def read_thread(*, number: int, kind: str) -> ThreadSnapshot:
    from dispatch import run_gh

    root = "repos/{owner}/{repo}"
    issue = json.loads(run_gh("api", f"{root}/issues/{number}"))
    comments = json.loads(
        run_gh("api", "--paginate", "--slurp", f"{root}/issues/{number}/comments?per_page=100")
    )
    snapshot: ThreadSnapshot = {
        "kind": kind,
        "number": number,
        "title": issue["title"],
        "body": issue["body"] or "",
        "user": snapshot_user(issue["user"]),
        "author_association": issue["author_association"],
        "comments": sorted_comments(comments),
    }
    if kind == "pr":
        pr_comment_sources: tuple[tuple[CommentKey, str], ...] = (
            ("reviews", "reviews"),
            ("review_comments", "comments"),
        )
        for key, suffix in pr_comment_sources:
            pages = json.loads(
                run_gh(
                    "api",
                    "--paginate",
                    "--slurp",
                    f"{root}/pulls/{number}/{suffix}?per_page=100",
                )
            )
            snapshot[key] = sorted_comments(pages)
    if len(canonical_json(snapshot)) > MAX_INPUT_BYTES:
        raise ValueError("too-large-to-scan: thread exceeds 512 KiB")
    return snapshot


def sorted_comments(pages: list[list[dict[str, Any]]]) -> list[SnapshotComment]:
    return sorted(
        [snapshot_comment(comment) for page in pages for comment in page],
        key=lambda comment: comment["id"],
    )


def snapshot_user(user: Optional[dict[str, Any]]) -> SnapshotUser:
    fields = user or {}
    return {"login": fields.get("login"), "id": fields.get("id"), "type": fields.get("type")}


def snapshot_comment(comment: dict[str, Any]) -> SnapshotComment:
    snapshot: dict[str, Any] = {
        "id": comment["id"],
        "body": comment["body"] or "",
        "user": snapshot_user(comment.get("user")),
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
    return cast(SnapshotComment, snapshot)


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
        [
            "git",
            "--no-optional-locks",
            "--literal-pathspecs",
            "-c",
            "core.hooksPath=/dev/null",
            *args,
        ],
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


def code_bundle(*, pr: dict[str, Any], destination: Path) -> tuple[CodeBundle, list[Finding]]:
    sha, base_sha = pr["headRefOid"], pr["baseRefOid"]
    if not all(re.fullmatch(r"[0-9a-f]{40}", s) for s in (sha, base_sha)):
        raise ValueError("Invalid commit identity")
    fetch = ["fetch", "--quiet", "--no-tags", "--no-recurse-submodules"]
    if git("rev-parse", "--is-shallow-repository") == "true":
        fetch.append("--unshallow")
    git(*fetch, "origin", sha, base_sha)
    base = git("merge-base", base_sha, sha)
    entries = git("diff", "--name-status", "--no-renames", "-z", base, sha, "--", binary=True)
    tokens = entries.rstrip(b"\0").split(b"\0") if entries else []
    changes = {tokens[i + 1].decode(): tokens[i].decode() for i in range(0, len(tokens), 2)}
    if len(changes) > MAX_FILES:
        raise ValueError("too-large-to-scan: more than 100 changed files")
    for path in changes:
        parts = PurePosixPath(path)
        if parts.is_absolute() or ".." in parts.parts or not parts.parts:
            raise ValueError("Unsafe changed path")
    findings: list[Finding] = []
    ranges: dict[str, list[tuple[int, int]]] = {}
    images: list[ScanImage] = []
    image_context: list[ImageText] = []
    text_paths = []
    image_patches = {}
    diff_parts = []
    total_bytes = 0
    for path, status in changes.items():
        before = read_blob(revision=base, path=path)
        after = read_blob(revision=sha, path=path)
        if after is not None and after.mode not in ("100644", "100755"):
            raise ValueError("Unsupported changed entry: links and special files are not admitted")
        if status != "D" and after is None:
            raise ValueError("Missing changed file")
        has_image = False
        revisions: tuple[tuple[Revision, Optional[GitBlob]], ...] = (
            ("before", before),
            ("after", after),
        )
        for revision, blob in revisions:
            if blob is None:
                continue
            total_bytes += len(blob.data)
            if total_bytes > MAX_CHANGED_BYTES:
                raise ValueError("too-large-to-scan: changed file versions exceed 32 MiB")
            if media_type := image_type(blob.data, path=path):
                has_image = True
                images.append(ScanImage(path, revision, media_type, blob.oid, blob.data))
                embedded_text = image_text(blob.data)
                image_context.append(ImageText(path, revision, embedded_text))
                findings.extend(
                    text_findings(path=f"{path} ({revision} image text)", text=embedded_text)
                )
        validate_images(images)
        if has_image:
            patch = image_diff(path=path, before=before, after=after)
            image_patches[path] = patch
        else:
            patch = git(
                "diff",
                "--text",
                "--no-ext-diff",
                "--no-textconv",
                "--no-color",
                base,
                sha,
                "--",
                path,
            )
        diff_parts.append(patch.rstrip("\n") + "\n")
        if sum(len(part.encode()) for part in diff_parts) > MAX_DIFF_BYTES:
            raise ValueError("too-large-to-scan: diff exceeds 256 KiB")
        if after is not None and image_type(after.data, path=path) is None:
            target = destination / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(after.data)
            text_paths.append(path)
    diff = "".join(diff_parts)
    context: list[FileContext] = []
    names = {PurePosixPath(p).name for p in changes}
    for path in text_paths:
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
        patch = image_patches.get(path) or git(
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
        context.append(FileContext(path, start + 1, snippet, len(snippet.encode()) < len(raw)))
    if text_paths:
        findings.extend(semgrep_findings(destination=destination, paths=text_paths, ranges=ranges))
    return (
        CodeBundle(
            sha=sha,
            base_sha=base_sha,
            merge_base=base,
            diff=diff,
            files=context,
            images=images,
            image_text=image_context,
            commit_messages=git("log", "--format=%B", f"{base}..{sha}"),
        ),
        findings,
    )


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


def unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result = dict(pairs)
    if len(result) != len(pairs):
        raise ValueError("Duplicate fields in the security verdict")
    return result


def parse_verdict(text: str) -> Verdict:
    result = json.loads(text, object_pairs_hook=unique_object)
    if (
        not isinstance(result, dict)
        or set(result) != {"verdict", "reason"}
        or result["verdict"] not in ("pass", "fail")
        or not isinstance(result["reason"], str)
        or not result["reason"].strip()
        or len(result["reason"]) > 4000
    ):
        raise ValueError("The security model returned an invalid verdict")
    return Verdict(result["verdict"], result["reason"])


def request_content(scan_input: ScanInput) -> Any:
    text = scan_input.serialize().decode("utf-8")
    if not scan_input.images:
        return text
    content: list[dict[str, Any]] = []
    for image in scan_input.images:
        content.extend(
            [
                {"type": "text", "text": "Untrusted image: " + json.dumps(image.metadata())},
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": image.media_type,
                        "data": base64.b64encode(image.data).decode("ascii"),
                    },
                },
            ]
        )
    content.append({"type": "text", "text": text})
    return content


def scan(scan_input: ScanInput) -> Verdict:
    """One tool-free Messages API request that returns a pass/fail verdict on the input."""
    validate_images(scan_input.images)
    with anthropic.Anthropic(timeout=TIMEOUT_SECONDS, max_retries=0) as client:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            thinking={"type": "adaptive"},
            output_config={
                "effort": EFFORT,
                "format": {"type": "json_schema", "schema": VERDICT_SCHEMA},
            },
            system=(FACTORY_DIR / "security_scan_prompt.md").read_text(),
            messages=[{"role": "user", "content": request_content(scan_input)}],
        )
    write_summary(
        f"Security scan {response.id}: model={MODEL}, effort={EFFORT}, "
        f"input_tokens={response.usage.input_tokens}, "
        f"output_tokens={response.usage.output_tokens}, stop_reason={response.stop_reason}"
    )
    if response.stop_reason != "end_turn":
        raise ValueError(
            f"The security model stopped before completing its scan ({response.stop_reason})"
        )
    if any(
        block.type not in ("text", "thinking", "redacted_thinking") for block in response.content
    ):
        raise ValueError("The security model returned unexpected content")
    texts = [block.text for block in response.content if block.type == "text"]
    if len(texts) != 1:
        raise ValueError("The security model did not return one verdict")
    return parse_verdict(texts[0])


def fingerprint(scan_input: ScanInput) -> str:
    """Hash of the serialized input plus the scanner policy: this module (so the model and
    request settings too), the Semgrep rules and the system prompt. Any change misses the cache."""
    policy = b"".join((FACTORY_DIR / name).read_bytes() for name in POLICY_FILES)
    return hashlib.sha256(scan_input.serialize() + policy).hexdigest()


def cached_verdict(*, key: str) -> tuple[Optional[Path], Optional[Verdict]]:
    cache_dir = os.environ.get("FACTORY_SCAN_CACHE_DIR")
    if not cache_dir:
        return None, None
    cache = Path(cache_dir) / f"{key}.json"
    return cache, parse_verdict(cache.read_text()) if cache.is_file() else None


def find_admission_problem(
    *,
    number: int,
    kind: str,
    pr: Optional[dict[str, Any]] = None,
    snapshot: Optional[ThreadSnapshot] = None,
    subject: Optional[dict[str, Any]] = None,
) -> Optional[str]:
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
        findings = [
            *text_findings(path=f"{kind}#{number}/title", text=snapshot["title"]),
            *text_findings(path=f"{kind}#{number}/body", text=snapshot["body"]),
        ]
        comment_keys: tuple[CommentKey, ...] = ("comments", "reviews", "review_comments")
        for key in comment_keys:
            for comment in snapshot.get(key, []):
                findings.extend(
                    text_findings(
                        path=f"{kind}#{number}/{key}/{comment['id']}", text=comment["body"]
                    )
                )
        with tempfile.TemporaryDirectory(prefix="factory-scan-") as directory:
            destination = Path(directory) / "files"
            destination.mkdir()
            code: Optional[CodeBundle] = None
            if pr is not None:
                code, code_findings = code_bundle(pr=pr, destination=destination)
                findings.extend(code_findings)
            scan_input = ScanInput(thread=snapshot, code=code, static_findings=findings)
            if len(scan_input.serialize()) > MAX_INPUT_BYTES:
                raise ValueError("too-large-to-scan: combined input exceeds 512 KiB")
            input_hash = fingerprint(scan_input)
            cache, verdict = cached_verdict(key=input_hash)
            if verdict is not None:
                write_summary(f"Admission scan cache hit: {input_hash}")
            else:
                verdict = scan(scan_input)
                if cache is not None:
                    cache.parent.mkdir(parents=True, exist_ok=True)
                    cache.write_bytes(canonical_json(asdict(verdict)))
            write_summary(
                f"Admission scan {kind}#{number}, SHA {code.sha if code else 'n/a'}, "
                f"input {input_hash}: {verdict.verdict}\n{verdict.reason}"
            )
            for finding in findings:
                write_summary(json.dumps(asdict(finding), ensure_ascii=True))
            if verdict.verdict == "fail":
                write_summary(
                    json.dumps(
                        asdict(
                            Finding(
                                f"{kind}#{number}",
                                1,
                                "hostile-toward-factory",
                                verdict.reason,
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
