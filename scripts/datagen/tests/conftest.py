"""Datagen tooling test configuration.

Puts the repository root on ``sys.path`` so tests can import the recorder
scripts as ``scripts.datagen.*`` without installing them as a package.
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
