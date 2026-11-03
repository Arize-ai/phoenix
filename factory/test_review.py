from review import ReviewThread, select_addressed_threads


def thread(thread_id: str, path: str, review_id: int) -> ReviewThread:
    return ReviewThread(id=thread_id, path=path, review_id=review_id)


def test_resolves_earlier_factory_threads_on_files_the_new_review_leaves_alone() -> None:
    threads = [
        thread("old-fixed", "factory/bootstrap.sh", 1),
        thread("old-same-file", "factory/agents/bug-fixer.md", 1),
        thread("new", "factory/agents/bug-fixer.md", 2),
        thread("human", "factory/review.py", 3),
    ]
    addressed = select_addressed_threads(
        threads=threads,
        factory_review_ids={1, 2},
        new_review_id=2,
        new_review_paths={"factory/agents/bug-fixer.md"},
    )
    assert [t.id for t in addressed] == ["old-fixed"]


def test_keeps_threads_without_a_review_or_path() -> None:
    threads = [
        ReviewThread(id="orphan", path=None, review_id=None),
        ReviewThread(id="summary", path=None, review_id=1),
    ]
    addressed = select_addressed_threads(
        threads=threads, factory_review_ids={1, 2}, new_review_id=2, new_review_paths=set()
    )
    assert [t.id for t in addressed] == ["summary"]
