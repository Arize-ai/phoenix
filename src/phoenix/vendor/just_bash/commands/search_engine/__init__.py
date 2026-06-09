"""Search engine utility module for grep and rg commands."""

from .matcher import SearchOptions, SearchResult, search_content
from .regex import RegexMode, build_regex, convert_replacement

__all__ = [
    "RegexMode",
    "build_regex",
    "convert_replacement",
    "SearchOptions",
    "SearchResult",
    "search_content",
]
