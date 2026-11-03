from review import ReviewThread, parse_resolved_thread_ids, select_resolvable_threads


def thread(thread_id: str, review_id: int) -> ReviewThread:
    return ReviewThread(
        id=thread_id, path="factory/review.py", line=1, comment_id=10, review_id=review_id
    )


def test_parses_the_resolved_threads_line() -> None:
    body = (
        "## Factory review of abc1234: Approve\n\n"
        "**Resolved threads:** PRRT_kwDOIZ8Ras6y7_kr, PRRT_kwDOIZ8Ras6y8AAA\n"
        "**Risk:** none\n"
    )
    assert parse_resolved_thread_ids(review_body=body) == [
        "PRRT_kwDOIZ8Ras6y7_kr",
        "PRRT_kwDOIZ8Ras6y8AAA",
    ]


def test_treats_a_missing_or_empty_line_as_nothing_to_resolve() -> None:
    assert parse_resolved_thread_ids(review_body="## Factory review of abc1234: Approve") == []
    assert parse_resolved_thread_ids(review_body="**Resolved threads:** none") == []


def test_resolves_only_ids_that_are_open_factory_threads() -> None:
    open_factory_threads = [thread("PRRT_fixed", 1), thread("PRRT_still_open", 1)]
    resolvable = select_resolvable_threads(
        requested_ids=["PRRT_fixed", "PRRT_not_ours", "PRRT_fixed"],
        open_factory_threads=open_factory_threads,
    )
    assert [t.id for t in resolvable] == ["PRRT_fixed"]
