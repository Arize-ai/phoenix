import pytest

from phoenix.server.cost_tracking.regex_specificity import (
    _find_bracket_end,
    _has_start_anchor,
    _is_valid_quantifier,
    _score_bracket,
    _score_char,
    _score_content,
    _score_escape,
    _score_quantifier,
    _strip_anchors,
    score,
)


@pytest.mark.parametrize(
    "pattern,expected",
    [
        pytest.param("^abc", True, id="start anchor"),
        pytest.param("abc", False, id="no anchor"),
        pytest.param("(?i)^abc", True, id="inline flag + anchor"),
        pytest.param("(?i)abc", False, id="inline flag only"),
        pytest.param("(?i)(?m)^abc", True, id="multiple flags + anchor"),
        pytest.param("(?i)^(?m)abc", True, id="flag-anchor-flag"),
        pytest.param("(?i)abc^", False, id="anchor not at start"),
        pytest.param("(?i)^", True, id="just anchor with flags"),
        pytest.param("(?i)", False, id="just flags"),
    ],
)
def test_has_start_anchor(pattern: str, expected: bool) -> None:
    assert _has_start_anchor(pattern) == expected


@pytest.mark.parametrize(
    "pattern,expected",
    [
        pytest.param("^abc$", "abc", id="anchors"),
        pytest.param("(?i)^abc$", "abc", id="inline flag + anchors"),
        pytest.param("abc", "abc", id="plain"),
        pytest.param("^abc", "abc", id="start anchor"),
        pytest.param("abc$", "abc", id="end anchor"),
        pytest.param("(?i)abc", "abc", id="inline flag only"),
        pytest.param("(?i)(?m)^abc$", "abc", id="multiple flags + anchors"),
        pytest.param("(?i)^(?m)abc$", "(?m)abc", id="flag-anchor-flag"),
    ],
)
def test_strip_anchors(pattern: str, expected: str) -> None:
    assert _strip_anchors(pattern) == expected


@pytest.mark.parametrize(
    "content,expected",
    [
        pytest.param("abc", 3000, id="literal characters"),
        pytest.param("a.b", 1800, id="literal with wildcard"),
        pytest.param("a?b", 1900, id="literal with optional"),
        pytest.param("a+b", 1850, id="literal with multiple"),
        pytest.param("a*b", 1850, id="literal with zero or more"),
        pytest.param("a|b", 1700, id="literal with alternation"),
        pytest.param("\\d", 400, id="shorthand class"),
        pytest.param("\\w", 400, id="word shorthand"),
        pytest.param("\\s", 400, id="space shorthand"),
        pytest.param("\\D", 250, id="negated shorthand"),
        pytest.param("\\W", 250, id="negated word shorthand"),
        pytest.param("\\S", 250, id="negated space shorthand"),
        pytest.param("\\.", 950, id="escaped dot"),
        pytest.param("\\+", 950, id="escaped plus"),
        pytest.param("\\*", 950, id="escaped star"),
        pytest.param("\\?", 950, id="escaped question"),
        pytest.param("\\|", 950, id="escaped pipe"),
        pytest.param("\\(", 950, id="escaped parenthesis"),
        pytest.param("\\)", 950, id="escaped closing parenthesis"),
        pytest.param("[abc]", 500, id="character class"),
        pytest.param("[^abc]", 300, id="negated character class"),
        pytest.param("[a-z]", 500, id="range character class"),
        pytest.param("[\\^abc]", 500, id="escaped caret in class"),
        pytest.param("[abc\\]]", 500, id="escaped bracket in class"),
        pytest.param("[a\\]b]", 500, id="escaped bracket in class"),
        pytest.param("a{3}", 950, id="exact quantifier"),
        pytest.param("a{3,5}", 900, id="range quantifier"),
        pytest.param("a{3,}", 900, id="open range quantifier"),
        pytest.param("abc", 3000, id="multiple literals"),
        pytest.param("a\\db", 2400, id="literal shorthand literal"),
        pytest.param("a[bc]d", 2500, id="literal class literal"),
        pytest.param("a{3}b", 1950, id="quantifier literal"),
        pytest.param("a|b|c", 2400, id="multiple alternations"),
    ],
)
def test_score_content(content: str, expected: int) -> None:
    assert _score_content(content) == expected


@pytest.mark.parametrize(
    "char,expected",
    [
        pytest.param("d", 400, id="digit shorthand"),
        pytest.param("w", 400, id="word shorthand"),
        pytest.param("s", 400, id="space shorthand"),
        pytest.param("D", 250, id="negated digit shorthand"),
        pytest.param("W", 250, id="negated word shorthand"),
        pytest.param("S", 250, id="negated space shorthand"),
        pytest.param(".", 950, id="escaped dot"),
        pytest.param("+", 950, id="escaped plus"),
        pytest.param("*", 950, id="escaped star"),
        pytest.param("?", 950, id="escaped question"),
        pytest.param("|", 950, id="escaped pipe"),
        pytest.param("(", 950, id="escaped parenthesis"),
        pytest.param(")", 950, id="escaped closing parenthesis"),
        pytest.param("a", 950, id="escaped letter"),
        pytest.param("1", 950, id="escaped digit"),
        pytest.param(" ", 950, id="escaped space"),
    ],
)
def test_score_escape(char: str, expected: int) -> None:
    assert _score_escape(char) == expected


@pytest.mark.parametrize(
    "content,start,expected_score,expected_pos",
    [
        pytest.param("[abc]", 0, 500, 5, id="simple character class"),
        pytest.param("[^abc]", 0, 300, 6, id="negated character class"),
        pytest.param("[a-z]", 0, 500, 5, id="range character class"),
        pytest.param("[\\^abc]", 0, 500, 7, id="escaped caret in class"),
        pytest.param("[abc\\]]", 0, 500, 7, id="escaped closing bracket"),
        pytest.param("[a\\]b]", 0, 500, 6, id="escaped bracket in middle"),
        pytest.param("[\\]abc]", 0, 500, 7, id="escaped bracket at start"),
        pytest.param("[a-]", 0, 500, 4, id="dash at end"),
        pytest.param("[-a]", 0, 500, 4, id="dash at start"),
        pytest.param("[a-z-]", 0, 500, 6, id="dash at end of range"),
        pytest.param("[-a-z]", 0, 500, 6, id="dash at start of range"),
        pytest.param("[a-z\\-]", 0, 500, 7, id="escaped dash"),
        pytest.param("abc[def]ghi", 3, 500, 8, id="class in middle"),
    ],
)
def test_score_bracket(content: str, start: int, expected_score: int, expected_pos: int) -> None:
    score_val, pos = _score_bracket(content, start)
    assert score_val == expected_score
    assert pos == expected_pos


@pytest.mark.parametrize(
    "content,start,expected_score,expected_pos",
    [
        pytest.param("a{3}", 1, -50, 4, id="exact quantifier"),
        pytest.param("a{3,5}", 1, -100, 6, id="range quantifier"),
        pytest.param("a{3,}", 1, -100, 5, id="open range quantifier"),
        pytest.param("a{0,3}", 1, -100, 6, id="range with zero"),
        pytest.param("abc{3}def", 3, -50, 6, id="quantifier in middle"),
        pytest.param("a{10}", 1, -50, 5, id="large exact quantifier"),
        pytest.param("a{1,100}", 1, -100, 8, id="large range quantifier"),
    ],
)
def test_score_quantifier(content: str, start: int, expected_score: int, expected_pos: int) -> None:
    score_val, pos = _score_quantifier(content, start)
    assert score_val == expected_score
    assert pos == expected_pos


@pytest.mark.parametrize(
    "quantifier,expected",
    [
        pytest.param("{3}", True, id="exact quantifier"),
        pytest.param("{3,5}", True, id="range quantifier"),
        pytest.param("{3,}", True, id="open range quantifier"),
        pytest.param("{0,3}", True, id="range with zero"),
        pytest.param("{10}", True, id="large exact"),
        pytest.param("{1,100}", True, id="large range"),
        pytest.param("{0,0}", True, id="zero range"),
        pytest.param("{", False, id="unclosed brace"),
        pytest.param("}", False, id="just closing brace"),
        pytest.param("{abc}", False, id="non-numeric content"),
        pytest.param("{3,abc}", False, id="non-numeric max"),
        pytest.param("{abc,3}", False, id="non-numeric min"),
        pytest.param("{3,5,7}", False, id="too many parts"),
        pytest.param("{5,3}", False, id="invalid range"),
        pytest.param("{,3}", False, id="empty min"),
        pytest.param("{3,}", True, id="empty max"),
        pytest.param("{}", False, id="empty content"),
    ],
)
def test_is_valid_quantifier(quantifier: str, expected: bool) -> None:
    assert _is_valid_quantifier(quantifier) == expected


@pytest.mark.parametrize(
    "char,expected",
    [
        pytest.param(".", -200, id="wildcard"),
        pytest.param("?", -100, id="optional"),
        pytest.param("|", -300, id="alternation"),
        pytest.param("+", -150, id="multiple"),
        pytest.param("*", -150, id="zero or more"),
        pytest.param("(", 0, id="opening parenthesis"),
        pytest.param(")", 0, id="closing parenthesis"),
        pytest.param("^", 0, id="caret"),
        pytest.param("$", 0, id="dollar"),
        pytest.param("a", 1000, id="letter"),
        pytest.param("1", 1000, id="digit"),
        pytest.param(" ", 1000, id="space"),
        pytest.param("!", 1000, id="punctuation"),
        pytest.param("@", 1000, id="symbol"),
        pytest.param("\\", 1000, id="backslash"),
    ],
)
def test_score_char(char: str, expected: int) -> None:
    assert _score_char(char) == expected


@pytest.mark.parametrize(
    "pattern,start,expected",
    [
        pytest.param("[abc]", 0, 4, id="simple class"),
        pytest.param("[^abc]", 0, 5, id="negated class"),
        pytest.param("[a-z]", 0, 4, id="range class"),
        pytest.param("[\\^abc]", 0, 6, id="escaped caret"),
        pytest.param("[abc\\]]", 0, 6, id="escaped closing bracket"),
        pytest.param("[a\\]b]", 0, 5, id="escaped bracket in middle"),
        pytest.param("[\\]abc]", 0, 6, id="escaped bracket at start"),
        pytest.param("[a-]", 0, 3, id="dash at end"),
        pytest.param("[-a]", 0, 3, id="dash at start"),
        pytest.param("[a-z-]", 0, 5, id="dash at end of range"),
        pytest.param("[-a-z]", 0, 5, id="dash at start of range"),
        pytest.param("[a-z\\-]", 0, 6, id="escaped dash"),
        pytest.param("abc[def]ghi", 3, 7, id="class in middle"),
        pytest.param("[", 0, -1, id="unclosed bracket"),
        pytest.param("abc[", 3, -1, id="unclosed bracket at end"),
        pytest.param("[abc", 0, -1, id="no closing bracket"),
    ],
)
def test_find_bracket_end(pattern: str, start: int, expected: int) -> None:
    assert _find_bracket_end(pattern, start) == expected


@pytest.mark.parametrize(
    "pattern,expected",
    [
        pytest.param("^abc$", 13010, id="exact match"),
        pytest.param("abc", 3006, id="literal"),
        pytest.param(".*", 1, id="wildcard"),
        pytest.param("[a-z]+", 362, id="class with quantifier"),
        pytest.param("\\d{3}", 360, id="shorthand with quantifier"),
        pytest.param("", 1, id="empty string"),
        pytest.param("^", 5002, id="just start anchor"),
        pytest.param("$", 5002, id="just end anchor"),
        pytest.param("^$", 10004, id="just anchors"),
        pytest.param("(?i)^abc$", 13018, id="inline flags"),
        pytest.param("(?i)abc", 3014, id="inline flags no anchors"),
        pytest.param("[a\\]b]", 512, id="escaped bracket in class"),
        pytest.param("[^abc]", 312, id="negated class"),
        pytest.param("\\D", 254, id="negated shorthand"),
        pytest.param("a{3,5}", 912, id="range quantifier"),
        pytest.param("a{3,}", 910, id="open range quantifier"),
        pytest.param("a?", 904, id="optional"),
        pytest.param("a+", 854, id="multiple"),
        pytest.param("a*", 854, id="zero or more"),
        pytest.param("a|b", 1706, id="alternation"),
        pytest.param("\\(\\)", 1908, id="escaped parentheses"),
        pytest.param("[a-z\\-]", 514, id="escaped dash in class"),
        pytest.param("[\\^abc]", 514, id="escaped caret in class"),
        pytest.param("[abc\\]]", 514, id="escaped closing bracket"),
        pytest.param("[\\]abc]", 514, id="escaped closing bracket at start"),
        pytest.param("(?i)(?m)^abc$", 13026, id="multiple inline flags"),
        pytest.param("[a-]", 508, id="dash at end of class"),
        pytest.param("[-a]", 508, id="dash at start of class"),
        pytest.param("[a-z-]", 512, id="dash at end of range"),
        pytest.param("[-a-z]", 512, id="dash at start of range"),
    ],
)
def test_score(pattern: str, expected: int) -> None:
    assert score(pattern) == expected


@pytest.mark.parametrize(
    "pattern",
    [
        pytest.param("{3}", id="quantifier without preceding char"),
        pytest.param("[", id="unclosed bracket"),
        pytest.param("\\", id="lone backslash"),
        pytest.param("(?", id="incomplete inline flags"),
        pytest.param("(?i", id="incomplete inline flags"),
    ],
)
def test_score_invalid_patterns(pattern: str) -> None:
    with pytest.raises(ValueError):
        score(pattern)


@pytest.mark.parametrize(
    "pattern,expected",
    [
        (r"^(models\/)?gemini-1\.5-flash(-\d*)?$", 34024),
        (r"^(models\/)?gemini-1\.5-flash-8b(-\d*)?$", 37030),
        (r"^(models\/)?gemini-1\.5-flash-8b-latest$", 42880),
        (r"^(models\/)?gemini-1\.5-flash-latest$", 39874),
        (r"^(models\/)?gemini-1\.5-pro(-\d*)?$", 32020),
        (r"^(models\/)?gemini-1\.5-pro-latest$", 37870),
        (r"^(models\/)?gemini-2\.0-flash(-\d*)?$", 34024),
        (r"^(models\/)?gemini-2\.0-flash-lite(-\d*)?$", 39034),
        (r"^(models\/)?gemini-2\.5-flash-preview-05-20$", 46888),
        (r"^(models\/)?gemini-2\.5-pro-preview-\d{2}-\d{2}$", 41596),
        (r"^anthropic\.claude-3-5-haiku(-\d{8})?(-v\d+)?(:[\d.]+)?$", 40712),
        (r"^anthropic\.claude-3-5-sonnet(-\d{8})?(-v\d+)?(:[\d.]+)?$", 41714),
        (r"^anthropic\.claude-3-7-sonnet(-\d{8})?(-v\d+)?(:[\d.]+)?$", 41714),
        (r"^anthropic\.claude-3-haiku(-\d{8})?(-v\d+)?(:[\d.]+)?$", 38708),
        (r"^anthropic\.claude-3-opus(-\d{8})?(-v\d+)?(:[\d.]+)?$", 37706),
        (r"^anthropic\.claude-opus-4(-\d{8})?(-v\d+)?(:[\d.]+)?$", 37706),
        (r"^anthropic\.claude-sonnet-4(-\d{8})?(-v\d+)?(:[\d.]+)?$", 39710),
        (r"^chatgpt-4o-latest$", 27038),
        (r"^claude-3-5-haiku(-\d{8}|-latest)?$", 34020),
        (r"^claude-3-5-sonnet(-\d{8}|-latest)?$", 35022),
        (r"^claude-3-7-sonnet(-\d{8}|-latest)?$", 35022),
        (r"^claude-3-haiku(-\d{8}|-latest)?$", 32016),
        (r"^claude-3-opus(-\d{8}|-latest)?$", 31014),
        (r"^claude-opus-4(-\d{8}|-latest)?$", 31014),
        (r"^claude-sonnet-4(-\d{8}|-latest)?$", 33018),
        (r"^ft:gpt-(3\.5|35)-turbo$", 27698),
        (r"^gpt-(3\.5|35)-turbo(-\d{4})?$", 25960),
        (r"^gpt-(3\.5|35)-turbo(-\d{4})?$", 25960),
        (r"^gpt-(3\.5|35)-turbo-0125$", 29702),
        (r"^gpt-(3\.5|35)-turbo-1106$", 29702),
        (r"^gpt-(3\.5|35)-turbo-16k(-\d{4})?$", 29968),
        (r"^gpt-(3\.5|35)-turbo-16k(-\d{4})?$", 29968),
        (r"^gpt-(3\.5|35)-turbo-instruct$", 33710),
        (r"^gpt-4(-\d{4})?$", 16282),
        (r"^gpt-4(-\d{4})?-vision-preview$", 31312),
        (r"^gpt-4-(\d{4}|turbo)-preview$", 29108),
        (r"^gpt-4-32k(-\d{4})?$", 20290),
        (r"^gpt-4-turbo$", 21026),
        (r"^gpt-4-turbo-2024-04-09$", 32048),
        (r"^gpt-4.5-preview$", 23834),
        (r"^gpt-4.5-preview-2025-02-27$", 34856),
        (r"^gpt-4\.1$", 16970),
        (r"^gpt-4\.1-2025-04-14$", 27992),
        (r"^gpt-4\.1-mini$", 21980),
        (r"^gpt-4\.1-mini-2025-04-14$", 33002),
        (r"^gpt-4\.1-nano$", 21980),
        (r"^gpt-4\.1-nano-2025-04-14$", 33002),
        (r"^gpt-4o$", 16016),
        (r"^gpt-4o$", 16016),
        (r"^gpt-4o-2024-05-13$", 27038),
        (r"^gpt-4o-2024-08-06$", 27038),
        (r"^gpt-4o-2024-08-06$", 27038),
        (r"^gpt-4o-2024-11-20$", 27038),
        (r"^gpt-4o-mini$", 21026),
        (r"^gpt-4o-mini-2024-07-18$", 32048),
        (r"^o1$", 12008),
        (r"^o1-2024-12-17$", 23030),
        (r"^o1-mini$", 17018),
        (r"^o1-mini-2024-09-12$", 28040),
        (r"^o1-preview$", 20024),
        (r"^o1-preview-2024-09-12$", 31046),
        (r"^o3(-\d{4}-\d{2}-\d{2})?$", 16000),
        (r"^o3-mini$", 17018),
        (r"^o3-mini-2025-01-31$", 28040),
        (r"^o4-mini(-\d{4}-\d{2}-\d{2})?$", 21010),
    ],
)
def test_special_model_patterns_score(pattern: str, expected: int) -> None:
    assert score(pattern) == expected
