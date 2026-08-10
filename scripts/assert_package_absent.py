#!/usr/bin/env python
"""Fail if a distribution is installed in the current environment.

An environment that exists to prove something still works *without* a package proves nothing once
that package creeps back into its resolved set — every test passes, and the green result reads as
coverage for a configuration that was never built.
"""

import sys
from importlib.metadata import PackageNotFoundError, version


def main(names: list[str]) -> int:
    installed = []
    for name in names:
        try:
            installed.append(f"{name}=={version(name)}")
        except PackageNotFoundError:
            continue
    if installed:
        print(f"expected to be absent but installed: {', '.join(installed)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"usage: {sys.argv[0]} <distribution-name> [...]", file=sys.stderr)
        raise SystemExit(2)
    raise SystemExit(main(sys.argv[1:]))
