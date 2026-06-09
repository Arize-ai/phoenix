"""Tests for search_engine utility module."""



class TestBuildRegex:
    """Test regex pattern building."""

    def test_extended_mode_default(self):
        """Extended mode is the default - standard regex syntax."""
        from just_bash.commands.search_engine.regex import RegexMode, build_regex
        regex = build_regex("a+b", RegexMode.EXTENDED)
        assert regex.search("aab") is not None
        assert regex.search("ab") is not None
        assert regex.search("a+b") is None  # Not literal

    def test_basic_mode_escapes_operators(self):
        """Basic mode escapes regex operators like +?|(){}."""
        from just_bash.commands.search_engine.regex import RegexMode, build_regex
        regex = build_regex("a+b", RegexMode.BASIC)
        # In basic mode, + is literal unless escaped
        assert regex.search("a+b") is not None
        # Extended patterns should NOT match
        assert regex.search("aab") is None

    def test_fixed_mode_literal(self):
        """Fixed mode treats pattern as literal string."""
        from just_bash.commands.search_engine.regex import RegexMode, build_regex
        regex = build_regex(".*", RegexMode.FIXED)
        assert regex.search(".*") is not None
        # Should NOT match arbitrary text
        assert regex.search("foo") is None

    def test_perl_mode(self):
        """Perl mode uses standard Python regex (PCRE-like)."""
        from just_bash.commands.search_engine.regex import RegexMode, build_regex
        regex = build_regex(r"\d+", RegexMode.PERL)
        assert regex.search("123") is not None

    def test_ignore_case(self):
        """Ignore case option."""
        from just_bash.commands.search_engine.regex import RegexMode, build_regex
        regex = build_regex("hello", RegexMode.EXTENDED, ignore_case=True)
        assert regex.search("HELLO") is not None
        assert regex.search("Hello") is not None

    def test_whole_word(self):
        """Whole word matching."""
        from just_bash.commands.search_engine.regex import RegexMode, build_regex
        regex = build_regex("test", RegexMode.EXTENDED, whole_word=True)
        assert regex.search("test") is not None
        assert regex.search("a test here") is not None
        assert regex.search("testing") is None
        assert regex.search("attest") is None

    def test_line_regexp(self):
        """Line regexp anchors to line start/end."""
        from just_bash.commands.search_engine.regex import RegexMode, build_regex
        regex = build_regex("hello", RegexMode.EXTENDED, line_regexp=True)
        assert regex.search("hello") is not None
        assert regex.search("hello world") is None
        assert regex.search("say hello") is None

    def test_multiline(self):
        """Multiline mode affects ^ and $."""
        from just_bash.commands.search_engine.regex import RegexMode, build_regex
        regex = build_regex("^test", RegexMode.EXTENDED, multiline=True)
        assert regex.search("line1\ntest") is not None


class TestConvertReplacement:
    """Test replacement string conversion."""

    def test_dollar_group_conversion(self):
        """Convert $0, $1 to Python format."""
        from just_bash.commands.search_engine.regex import convert_replacement
        assert convert_replacement("$0") == r"\g<0>"
        assert convert_replacement("$1") == r"\1"
        assert convert_replacement("prefix-$1-suffix") == r"prefix-\1-suffix"

    def test_named_group_conversion(self):
        """Convert $name to Python format."""
        from just_bash.commands.search_engine.regex import convert_replacement
        assert convert_replacement("$name") == r"\g<name>"


class TestSearchOptions:
    """Test SearchOptions dataclass."""

    def test_default_values(self):
        """SearchOptions has sensible defaults."""
        from just_bash.commands.search_engine.matcher import SearchOptions
        opts = SearchOptions()
        assert opts.invert_match is False
        assert opts.show_line_numbers is False
        assert opts.count_only is False
        assert opts.before_context == 0
        assert opts.after_context == 0


class TestSearchContent:
    """Test content searching functionality."""

    def test_basic_match(self):
        """Basic pattern matching."""
        from just_bash.commands.search_engine.matcher import SearchOptions, search_content
        from just_bash.commands.search_engine.regex import RegexMode, build_regex
        regex = build_regex("world", RegexMode.EXTENDED)
        result = search_content("hello\nworld\nfoo", regex, SearchOptions())
        assert result.matched is True
        assert result.match_count == 1
        assert "world" in result.output

    def test_no_match(self):
        """No match returns empty result."""
        from just_bash.commands.search_engine.matcher import SearchOptions, search_content
        from just_bash.commands.search_engine.regex import RegexMode, build_regex
        regex = build_regex("xyz", RegexMode.EXTENDED)
        result = search_content("hello\nworld", regex, SearchOptions())
        assert result.matched is False
        assert result.match_count == 0

    def test_invert_match(self):
        """Invert match returns non-matching lines."""
        from just_bash.commands.search_engine.matcher import SearchOptions, search_content
        from just_bash.commands.search_engine.regex import RegexMode, build_regex
        regex = build_regex("world", RegexMode.EXTENDED)
        result = search_content("hello\nworld\nfoo", regex, SearchOptions(invert_match=True))
        assert result.matched is True
        assert "hello" in result.output
        assert "foo" in result.output
        assert "world" not in result.output

    def test_line_numbers(self):
        """Show line numbers option."""
        from just_bash.commands.search_engine.matcher import SearchOptions, search_content
        from just_bash.commands.search_engine.regex import RegexMode, build_regex
        regex = build_regex("world", RegexMode.EXTENDED)
        result = search_content("hello\nworld\nfoo", regex, SearchOptions(show_line_numbers=True))
        assert "2:" in result.output  # Line 2

    def test_count_only(self):
        """Count only mode."""
        from just_bash.commands.search_engine.matcher import SearchOptions, search_content
        from just_bash.commands.search_engine.regex import RegexMode, build_regex
        regex = build_regex("o", RegexMode.EXTENDED)
        result = search_content("hello\nworld\nfoo", regex, SearchOptions(count_only=True))
        assert result.match_count == 4  # 'o' in hello(1), world(1), foo(2)

    def test_only_matching(self):
        """Only matching mode shows just the matched text."""
        from just_bash.commands.search_engine.matcher import SearchOptions, search_content
        from just_bash.commands.search_engine.regex import RegexMode, build_regex
        regex = build_regex("[a-z]+", RegexMode.EXTENDED)
        result = search_content("test123", regex, SearchOptions(only_matching=True))
        assert "test" in result.output
        assert "123" not in result.output

    def test_before_context(self):
        """Before context lines."""
        from just_bash.commands.search_engine.matcher import SearchOptions, search_content
        from just_bash.commands.search_engine.regex import RegexMode, build_regex
        regex = build_regex("c", RegexMode.EXTENDED)
        result = search_content("a\nb\nc\nd\ne", regex, SearchOptions(before_context=1))
        assert "b" in result.output
        assert "c" in result.output

    def test_after_context(self):
        """After context lines."""
        from just_bash.commands.search_engine.matcher import SearchOptions, search_content
        from just_bash.commands.search_engine.regex import RegexMode, build_regex
        regex = build_regex("c", RegexMode.EXTENDED)
        result = search_content("a\nb\nc\nd\ne", regex, SearchOptions(after_context=1))
        assert "c" in result.output
        assert "d" in result.output

    def test_context_both(self):
        """Both before and after context."""
        from just_bash.commands.search_engine.matcher import SearchOptions, search_content
        from just_bash.commands.search_engine.regex import RegexMode, build_regex
        regex = build_regex("c", RegexMode.EXTENDED)
        opts = SearchOptions(before_context=1, after_context=1)
        result = search_content("a\nb\nc\nd\ne", regex, opts)
        assert "b" in result.output
        assert "c" in result.output
        assert "d" in result.output

    def test_max_count(self):
        """Max count limits matches."""
        from just_bash.commands.search_engine.matcher import SearchOptions, search_content
        from just_bash.commands.search_engine.regex import RegexMode, build_regex
        regex = build_regex(".", RegexMode.EXTENDED)
        result = search_content("a\nb\nc\nd\ne", regex, SearchOptions(max_count=2))
        # Should only report 2 matches
        assert result.match_count <= 2

    def test_filename_prefix(self):
        """Filename prefix in output."""
        from just_bash.commands.search_engine.matcher import SearchOptions, search_content
        from just_bash.commands.search_engine.regex import RegexMode, build_regex
        regex = build_regex("test", RegexMode.EXTENDED)
        result = search_content("test line", regex, SearchOptions(filename="file.txt"))
        assert "file.txt:" in result.output

    def test_replace(self):
        """Replace matched content."""
        from just_bash.commands.search_engine.matcher import SearchOptions, search_content
        from just_bash.commands.search_engine.regex import RegexMode, build_regex
        regex = build_regex("world", RegexMode.EXTENDED)
        result = search_content("hello world", regex, SearchOptions(replace="universe"))
        assert "universe" in result.output
        assert "world" not in result.output


class TestSearchResult:
    """Test SearchResult dataclass."""

    def test_search_result_properties(self):
        """SearchResult has expected properties."""
        from just_bash.commands.search_engine.matcher import SearchResult
        result = SearchResult(output="line1\nline2\n", matched=True, match_count=2)
        assert result.output == "line1\nline2\n"
        assert result.matched is True
        assert result.match_count == 2
