import re
from dataclasses import dataclass
from typing import Literal, cast

DatabaseEngine = Literal["sqlite", "postgres"]
DatabaseOption = Literal["sqlite", "postgres", "both"]
Revision = Literal["base", "head"]
DATABASE_OPTIONS = ("sqlite", "postgres", "both")
BASELINE_OPTIONS = ("on", "off")
FENCE_PATTERN = re.compile(r"^\s*(`{3,}|~{3,})(.*)$")
CLOSING_FENCE_MAX_EXTRA_INDENT = 3
SETTING_PATTERN = re.compile(r"^ {0,3}(?:- )?Preview (baseline|database)\s*:\s*(.*?)\s*$", re.I)


@dataclass(frozen=True)
class PreviewSettings:
    include_baseline: bool = True
    database: DatabaseOption = "both"

    @property
    def revisions(self) -> tuple[Revision, ...]:
        return ("base", "head") if self.include_baseline else ("head",)

    @property
    def engines(self) -> tuple[DatabaseEngine, ...]:
        return ("sqlite", "postgres") if self.database == "both" else (self.database,)


def closes_fence(line: str, fence: re.Match[str], opening_fence: str, indent: int) -> bool:
    return (
        fence[1][0] == opening_fence[0]
        and len(fence[1]) >= len(opening_fence)
        and not fence[2].strip()
        and len(line) - len(line.lstrip(" ")) <= indent + CLOSING_FENCE_MAX_EXTRA_INDENT
    )


def parse_settings(body: str) -> PreviewSettings:
    settings: dict[str, str] = {}
    opening_fence = ""
    indent = 0
    for line in body.splitlines():
        fence = FENCE_PATTERN.match(line)
        if opening_fence:
            if fence and closes_fence(line, fence, opening_fence, indent):
                opening_fence = ""
        elif fence:
            opening_fence = fence[1]
            indent = len(line) - len(line.lstrip(" "))
        elif match := SETTING_PATTERN.fullmatch(line):
            field, value = (part.lower() for part in match.groups())
            if field in settings:
                raise ValueError(f"Specify Preview {field} only once.")
            allowed = BASELINE_OPTIONS if field == "baseline" else DATABASE_OPTIONS
            if value not in allowed:
                raise ValueError(f"Preview {field} must be one of: {', '.join(allowed)}.")
            settings[field] = value
    return PreviewSettings(
        include_baseline=settings.get("baseline", "on") == "on",
        database=cast(DatabaseOption, settings.get("database", "both")),
    )
