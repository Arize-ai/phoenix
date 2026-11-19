"""Regression coverage for CommonMark whitespace around link destinations."""

import pytest

from evals.pxi.evaluators.links import evaluate_in_app_links


@pytest.mark.parametrize("padding", [" ", "\t", "\n", " \n\t"])
def test_destination_padding(padding: str) -> None:
    result = evaluate_in_app_links(
        {"assistant_text": f"[Trace]({padding}/redirects/traces/abc{padding})"},
        {"links": {"required_in_app": ["/redirects/traces/abc"]}},
    )
    assert result["score"] == 1


@pytest.mark.parametrize(
    "destination", ["/wrong", "/redirects/traces/a bc", "\n\n/redirects/traces/abc"]
)
def test_invalid_destination_does_not_pass(destination: str) -> None:
    result = evaluate_in_app_links(
        {"assistant_text": f"[Trace]( {destination} )"},
        {"links": {"required_in_app": ["/redirects/traces/abc"]}},
    )
    assert result["score"] == 0


@pytest.mark.parametrize(
    "href, score",
    [
        ("/projects/UHJvamVjdDo0Nw%3D%3D/traces/abc", 1),
        ("/projects/UHJvamVjdDo0Nw==/traces/abc", 1),
        ("/projects/UHJvamVjdDo0Nw%253D%253D/traces/abc", 0),
        ("/projects/UHJvamVjdDo0Nw%3D%3D%2Ftraces/abc", 0),
        ("https://localhost/projects/UHJvamVjdDo0Nw%3D%3D/traces/abc", 0),
        ("/projects/UHJvamVjdDo0Nw%3D%3D/traces/wrong", 0),
    ],
)
def test_encoded_route_parameters(href: str, score: int) -> None:
    result = evaluate_in_app_links(
        {"assistant_text": f"[Trace]({href})"},
        {"links": {"required_in_app": ["/projects/UHJvamVjdDo0Nw==/traces/abc"]}},
    )
    assert result["score"] == score
