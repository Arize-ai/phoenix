from phoenix.evals.utils import NOT_PARSABLE, snap_to_rail


def test_snap_to_rail():
    assert snap_to_rail("irrelevant", ["relevant", "irrelevant"]) == "irrelevant"
    assert snap_to_rail("relevant", ["relevant", "irrelevant"]) == "relevant"
    assert snap_to_rail("irrelevant...", ["irrelevant", "relevant"]) == "irrelevant"
    assert snap_to_rail("...irrelevant", ["irrelevant", "relevant"]) == "irrelevant"
    # Both rails are present, cannot parse
    assert snap_to_rail("relevant...irrelevant", ["irrelevant", "relevant"]) is NOT_PARSABLE
    assert snap_to_rail("Irrelevant", ["relevant", "irrelevant"]) == "irrelevant"
    # One rail appears twice
    assert snap_to_rail("relevant...relevant", ["irrelevant", "relevant"]) == "relevant"
    assert snap_to_rail("b b", ["a", "b", "c"]) == "b"
    # More than two rails
    assert snap_to_rail("a", ["a", "b", "c"]) == "a"
    assert snap_to_rail(" abc", ["a", "ab", "abc"]) == "abc"
    assert snap_to_rail("abc", ["abc", "a", "ab"]) == "abc"
