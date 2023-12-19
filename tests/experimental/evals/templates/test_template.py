from phoenix.experimental.evals.templates.template import NOT_PARSABLE, _snap_to_rail


def test_snap_to_rail():
    assert _snap_to_rail("irrelevant", ["relevant", "irrelevant"]) == "irrelevant"
    assert _snap_to_rail("relevant", ["relevant", "irrelevant"]) == "relevant"
    assert _snap_to_rail("irrelevant...", ["irrelevant", "relevant"]) == "irrelevant"
    assert _snap_to_rail("...irrelevant", ["irrelevant", "relevant"]) == "irrelevant"
    # Both rails are present, cannot parse
    assert _snap_to_rail("relevant...irrelevant", ["irrelevant", "relevant"]) is NOT_PARSABLE
    assert _snap_to_rail("Irrelevant", ["relevant", "irrelevant"]) == "irrelevant"
    # One rail appears twice
    assert _snap_to_rail("relevant...relevant", ["irrelevant", "relevant"]) == "relevant"
    assert _snap_to_rail("b b", ["a", "b", "c"]) == "b"
    # More than two rails
    assert _snap_to_rail("a", ["a", "b", "c"]) == "a"
    assert _snap_to_rail(" abc", ["a", "ab", "abc"]) == "abc"
    assert _snap_to_rail("abc", ["abc", "a", "ab"]) == "abc"
