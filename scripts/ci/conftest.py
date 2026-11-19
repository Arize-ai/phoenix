"""Make the helper modules beside these checks importable under ``--import-mode=importlib``."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
