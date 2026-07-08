import re
from typing import Any, Dict, List

import pytest

from phoenix.evals.metrics import MatchesRegex


def _scores_by_name(scores: List[Any]) -> Dict[str, float]:
    return {s.name: s.score for s in scores}


@pytest.mark.parametrize(
    "description, kwargs, output, expected_names, expected_scores, expected_explanation",
    [
        pytest.param(
            "phone number match",
            dict(pattern=r"\+?\d{1,3}[- ]?\d{3}[- ]?\d{3}[- ]?\d{4}"),
            "Call me at +1-800-555-1234 tomorrow.",
            ["matches_regex"],
            dict(matches_regex=1.0),
            "There are 1 matches for the regex: \\+?\\d{1,3}[- ]?\\d{3}[- ]?\\d{3}[- ]?\\d{4}",
            id="phone-number",
        ),
        pytest.param(
            "github repo url match",
            dict(pattern=r"https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+"),
            "Check out https://github.com/Arize-ai/phoenix for the source code.",
            ["matches_regex"],
            dict(matches_regex=1.0),
            "There are 1 matches for the regex: https://github\\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+",
            id="github-link-arize-phoenix",
        ),
        pytest.param(
            "email address match",
            dict(pattern=r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"),
            "Send feedback to test.user@example.com please.",
            ["matches_regex"],
            dict(matches_regex=1.0),
            "There are 1 matches for the regex: [a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
            id="email-address",
        ),
        pytest.param(
            "empty string no match",
            dict(pattern=r"\d+"),
            "",
            ["matches_regex"],
            dict(matches_regex=0.0),
            "No substrings matched the regex pattern \\d+",
            id="empty-string-no-match",
        ),
    ],
)
def test_matches_regex_success(
    description: str,
    kwargs: Dict[str, Any],
    output: str,
    expected_names: List[str],
    expected_scores: Dict[str, float],
    expected_explanation: str,
) -> None:
    evaluator = MatchesRegex(**kwargs)
    scores = evaluator.evaluate({"output": output})
    names = [s.name for s in scores]

    assert names == expected_names
    by_name = _scores_by_name(scores)

    for key, expected in expected_scores.items():
        assert by_name[key] == pytest.approx(expected, rel=1e-6, abs=1e-12)

    if expected_explanation is not None:
        assert scores[0].explanation == expected_explanation
    else:
        assert scores[0].explanation is None


@pytest.mark.parametrize(
    "description, kwargs",
    [
        pytest.param(
            "invalid regex pattern string raises re.error",
            dict(pattern="("),
            id="invalid-pattern",
        ),
    ],
)
def test_matches_regex_errors(description: str, kwargs: Dict[str, Any]) -> None:
    with pytest.raises(re.error):
        _ = MatchesRegex(**kwargs)
