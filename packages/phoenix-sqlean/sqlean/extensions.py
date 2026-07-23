"""
Extension management.
"""

import os

_extensions = {
    "crypto",
    "define",
    "fileio",
    "fuzzy",
    "ipaddr",
    "regexp",
    "stats",
    "text",
    "time",
    "unicode",
    "uuid",
    "vsv",
}


def enable_all():
    """Enables all extensions."""
    os.environ["SQLEAN_ENABLE"] = "1"


def disable_all():
    """Disables all extensions."""
    os.environ["SQLEAN_ENABLE"] = "0"


def enable(*names):
    """Enables specific extensions."""
    _clear_flags()
    for name in names:
        if name not in _extensions:
            continue
        os.environ[f"SQLEAN_ENABLE_{name.upper()}"] = "1"


def disable(*names):
    """Disables specific extensions."""
    _clear_flags()
    for name in names:
        if name not in _extensions:
            continue
        os.environ[f"SQLEAN_ENABLE_{name.upper()}"] = "0"


def _clear_flags():
    """Clears 'enabled' flags for all extensions."""
    if "SQLEAN_ENABLE" in os.environ:
        del os.environ["SQLEAN_ENABLE"]
    for name in _extensions:
        flag = f"SQLEAN_ENABLE_{name.upper()}"
        if flag in os.environ:
            del os.environ[flag]
