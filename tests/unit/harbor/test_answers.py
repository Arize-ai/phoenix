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


def test_exact_trims_only() -> None:
    assert answers.match_exact("ok\n", "ok")
    assert not answers.match_exact("okay", "ok")
    assert not answers.match_exact("OK", "ok")
