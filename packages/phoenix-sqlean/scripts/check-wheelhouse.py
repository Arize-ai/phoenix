"""Fail unless a directory holds exactly the distributions a release ships.

Expected: one sdist, plus one wheel per CPython version that setup.py's
python_requires admits on each platform below. PLATFORMS must match the
runners in phoenix-sqlean-build.yml and the archs in cibuildwheel.toml.

Usage: python check-wheelhouse.py <setup.py> <dist dir>
"""

import re
import sys
from pathlib import Path

DIST_NAME = "arize_phoenix_sqlean"

# Each platform tag must match exactly one entry. Linux and macOS tags carry a
# glibc or deployment-target version that the build image decides, and a
# compressed tag set (a.b) must have every member match the same entry.
PLATFORMS = {
    "linux-x86_64": re.compile(r"manylinux(_\d+_\d+|2014)_x86_64"),
    "linux-aarch64": re.compile(r"manylinux(_\d+_\d+|2014)_aarch64"),
    "macos-x86_64": re.compile(r"macosx_\d+_\d+_x86_64"),
    "macos-arm64": re.compile(r"macosx_\d+_\d+_arm64"),
    "windows-amd64": re.compile(r"win_amd64"),
    "windows-arm64": re.compile(r"win_arm64"),
}

WHEEL = re.compile(
    rf"{DIST_NAME}-(?P<version>[^-]+)-(?P<python>cp3\d+)-(?P<abi>[^-]+)-(?P<platform>[^-]+)\.whl"
)
SDIST = re.compile(rf"{DIST_NAME}-(?P<version>[^-]+)\.tar\.gz")
REQUIRES = re.compile(r'python_requires=">=3\.(\d+), <3\.(\d+)"')


def admitted_minors(setup_py: Path) -> range:
    matches = REQUIRES.findall(setup_py.read_text())
    if len(matches) != 1:
        sys.exit(f'{setup_py}: expected one python_requires=">=3.X, <3.Y", found {len(matches)}')
    low, high = matches[0]
    return range(int(low), int(high))


def platform_of(tag: str) -> str | None:
    kinds = {
        kind
        for part in tag.split(".")
        for kind, pattern in PLATFORMS.items()
        if pattern.fullmatch(part)
    }
    if len(kinds) != 1:
        return None
    (kind,) = kinds
    return kind if all(PLATFORMS[kind].fullmatch(part) for part in tag.split(".")) else None


def main() -> None:
    setup_py, dist = Path(sys.argv[1]), Path(sys.argv[2])
    pythons = [f"cp3{minor}" for minor in admitted_minors(setup_py)]
    expected = {(python, kind) for python in pythons for kind in PLATFORMS}

    errors: list[str] = []
    seen: dict[tuple[str, str], str] = {}
    versions: set[str] = set()
    sdists: list[str] = []

    for path in sorted(dist.iterdir()):
        name = path.name
        if sdist := SDIST.fullmatch(name):
            sdists.append(name)
            versions.add(sdist["version"])
            continue
        wheel = WHEEL.fullmatch(name)
        if not wheel:
            errors.append(f"unexpected file: {name}")
            continue
        versions.add(wheel["version"])
        kind = platform_of(wheel["platform"])
        key = (wheel["python"], kind or "")
        if wheel["abi"] != wheel["python"]:
            errors.append(f"unexpected ABI tag {wheel['abi']}: {name}")
        elif kind is None:
            errors.append(f"unexpected platform tag {wheel['platform']}: {name}")
        elif key not in expected:
            errors.append(f"not admitted by python_requires: {name}")
        elif key in seen:
            errors.append(f"duplicate of {seen[key]}: {name}")
        else:
            seen[key] = name

    for python, kind in sorted(expected - seen.keys()):
        errors.append(f"missing wheel: {python} {kind}")
    if len(sdists) != 1:
        errors.append(f"expected 1 sdist, found {len(sdists)}: {sdists}")
    if len(versions) > 1:
        errors.append(f"mixed package versions: {sorted(versions)}")

    if errors:
        print("\n".join(errors), file=sys.stderr)
        sys.exit(1)
    print(f"{len(seen)} wheels ({', '.join(pythons)} x {len(PLATFORMS)} platforms) and 1 sdist")


if __name__ == "__main__":
    main()
