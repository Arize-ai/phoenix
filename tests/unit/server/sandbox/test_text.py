"""Tests for ``phoenix.server.sandbox._text`` — the shared ANSI helper."""

from __future__ import annotations

from phoenix.server.sandbox._text import strip_ansi, strip_ansi_optional


class TestStripAnsi:
    def test_strips_colored_text(self) -> None:
        assert strip_ansi("\x1b[31mred\x1b[0m") == "red"

    def test_strips_compound_sequence(self) -> None:
        assert strip_ansi("\x1b[0m\x1b[1m\x1b[31merror\x1b[0m: details") == "error: details"

    def test_preserves_plain_text(self) -> None:
        assert strip_ansi("plain text\nwith newlines") == "plain text\nwith newlines"

    def test_empty_string_passes_through(self) -> None:
        assert strip_ansi("") == ""


class TestStripAnsiOptional:
    def test_none_returns_none(self) -> None:
        assert strip_ansi_optional(None) is None

    def test_string_is_stripped(self) -> None:
        assert strip_ansi_optional("\x1b[31mred\x1b[0m") == "red"

    def test_empty_string_returns_empty(self) -> None:
        assert strip_ansi_optional("") == ""
