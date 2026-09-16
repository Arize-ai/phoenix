import pytest

from evals.harbor.lib import answers


@pytest.mark.parametrize(
    "text",
    ["117", "117.", "There are **117** traces.", "117 traces (3,579 spans)", "`117`"],
)
def test_integer_matches_stated_value(text: str) -> None:
    assert answers.match_integer(text, 117)


@pytest.mark.parametrize("text", ["118", "1,170", "117 or 118", "about 117", "117?", "", "11.7"])
def test_integer_rejects_wrong_or_hedged_values(text: str) -> None:
    assert not answers.match_integer(text, 117)


def test_integer_with_aliases_reads_the_value_beside_its_name() -> None:
    aliases = ["traces"]
    assert answers.match_integer("117", 117, aliases)
    assert answers.match_integer("3,579 spans across 117 traces.", 117, aliases)
    assert answers.match_integer("117 traces.\n\nI paged 500 spans at a time.", 117, aliases)
    assert not answers.match_integer(
        "117 rows on page one; the project has 118 traces.", 117, aliases
    )
    assert not answers.match_integer("118 traces (117 of them with spans).", 117, aliases)
    assert not answers.match_integer("3,579 spans; the longest trace has 117 spans.", 117, aliases)


def test_number_with_aliases_reads_the_value_beside_its_name() -> None:
    aliases = ["cost", "total"]
    assert answers.match_number("$16.00", 16.0022, places=2, aliases=aliases)
    assert answers.match_number(
        "117 traces cost $16.00 in total.", 16.0022, places=2, aliases=aliases
    )
    assert not answers.match_number(
        "The top trace cost $2.10; the total was $16.10.", 16.0022, places=2, aliases=aliases
    )
    assert not answers.match_number(
        "$16.00 for trail-gaia; this run cost $16.10.", 16.0, 2, aliases
    )


def test_number_rounds_both_sides() -> None:
    assert answers.match_number("$0.42", 0.4213, places=2)
    assert answers.match_number("0.4213 USD", 0.42, places=2)
    assert answers.match_number("The top 10% of traces account for 61.3% of spend", 61.26, places=1)
    assert not answers.match_number("61.3%", 62.0, places=1)
    assert not answers.match_number("roughly 61.3%", 61.3, places=1)


def test_name_matches_whole_word_aliases() -> None:
    groups = [["PageDownTool", "page_down"], ["SearchTool"]]
    assert answers.match_name("The failing tool is PageDownTool.", groups)
    assert answers.match_name("page_down failed most", groups)
    assert not answers.match_name("PageDown failed most", groups)
    assert not answers.match_name("PageDownTool", groups, require_all=True)
    assert answers.match_name("PageDownTool and SearchTool", groups, require_all=True)
    assert not answers.match_name("maybe PageDownTool", groups)


def test_exact_ignores_case_emphasis_and_end_punctuation() -> None:
    assert answers.match_exact("ok\n", "ok")
    assert answers.match_exact("**OK**.", "ok")
    assert not answers.match_exact("okay", "ok")
    assert not answers.match_exact("ok ok", "ok")


LABELS = {"short": (["short", "<15"], 0.7949), "long": (["long", "at least 40"], 14.6067)}


@pytest.mark.parametrize(
    "text",
    [
        "Short: 0.8%; Long: 14.6%",
        "Short: 0.8%\nLong: 14.6%",
        "Short traces had a 0.8% error rate, compared with 14.6% for long traces.",
        "14.6% for long traces and 0.8% for short ones.",
        "Long (at least 40 spans): 14.61% (312/2136). Short (<15): 0.79% (5/629).",
    ],
)
def test_labeled_number_accepts_values_beside_their_labels(text: str) -> None:
    assert answers.match_labeled_number(text, LABELS, places=1)


@pytest.mark.parametrize(
    "text",
    [
        "Short: 14.6%; Long: 0.8%",
        "The two rates were 0.8% and 14.6%.",
        "Short: 0.8%",
        "Short: 0.8%; Long: about 14.6%",
        "Short: 1.2%; Long: 14.6%",
        "",
    ],
)
def test_labeled_number_rejects_reversed_unlabelled_or_partial(text: str) -> None:
    assert not answers.match_labeled_number(text, LABELS, places=1)


@pytest.mark.parametrize(
    "text",
    [
        "FinderTool: 24 calls",
        "24 calls to FinderTool",
        "The most repeated tool is FinderTool, with 24 calls in one trace.",
        "FinderTool was called 24 times in one trace; SearchInformationTool 20 in another.",
        "SearchInformationTool: 20\nFinderTool: 24",
    ],
)
def test_entity_count_accepts_count_nearest_the_entity(text: str) -> None:
    assert answers.match_entity_count(text, ["FinderTool"], 24)


@pytest.mark.parametrize(
    "text",
    [
        "FinderTool had 20 calls; SearchInformationTool had 24.",
        "SearchInformationTool: 24 calls",
        "FinderTool: 23 calls",
        "FinderTool: 24 or 25 calls",
        "24",
        "",
    ],
)
def test_entity_count_rejects_other_claims(text: str) -> None:
    assert not answers.match_entity_count(text, ["FinderTool"], 24)
