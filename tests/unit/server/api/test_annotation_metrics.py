from phoenix.server.api.annotation_metrics import get_bounded_annotation_labels


def test_get_bounded_annotation_labels_preserves_small_label_sets() -> None:
    assert get_bounded_annotation_labels(
        ["pass", "fail"],
        [("pass", 10)],
    ) == ["fail", "pass"]


def test_get_bounded_annotation_labels_ranks_large_sets_by_reference_count() -> None:
    labels = [f"label-{index:02d}" for index in range(15)]
    reference_counts = [(label, 1) for label in labels]
    reference_counts[-1] = (labels[-1], 10)

    assert get_bounded_annotation_labels(labels, reference_counts) == [
        "label-14",
        *[f"label-{index:02d}" for index in range(11)],
    ]
