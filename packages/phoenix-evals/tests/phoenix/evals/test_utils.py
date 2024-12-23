from dataclasses import dataclass

from phoenix.evals.utils import NOT_PARSABLE, get_audio_format_from_base64, snap_to_rail


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


def test_get_audio_format_from_base64():
    @dataclass
    class Sample:
        enc_data: str
        format: str

    samples = [
        Sample(
            enc_data="UklGRiSaCABXQVZFZm10IBAAAAABAAIARKwAABCxAgAEABAAZGF0YQCaCABy+HL4BPsE+w//D"
                     "/9WAlYCGgEaAfIA8gA6AToB0ADQ",
            format="wav",
        ),
        Sample(
            enc_data="SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU3LjgzLjEwMAAAAAAAAAAAAAAA"
                     "//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            format="mp3",
        ),
        Sample(
            enc_data="T2dnUwACAAAAAAAAAABdwLNHAAAAANYQEycBHgF2b3JiaXMAAAAAAkSsAAAAAAAAA3ECAAAAAA"
                     "C4AU9nZ1MAAAAAAAAAAAAAXcCz",
            format="ogg",
        ),
        Sample(
            enc_data="ZkxhQwAAACISABIAAAkBADcsCsRC8ABHLQsq7uacAVPLZSxxjf3w6f8tBAAALg0AAABMYXZmNTc"
                     "uODMuMTAwAQAAABUAAABlbmNv",
            format="flac",
        ),
        Sample(
            enc_data="//FQgAP//N4EAExhdmM1Ny4xMDcuMTAwAEIgCMEYOP/xUIBxH/whKwwBNFoeYDeQgCQQEQQCgQC"
                     "w7jBLFAWFQ2EiTzU874zjjPP3",
            format="aac",
        ),
        Sample(
            enc_data="cvhy+AT7BPsP/w//VgJWAhoBGgHyAPIAOgE6AdAA0ACA/4D/Nvs2+735vfkC+AL4EfYR9izyLPL"
                     "Z9dn1AvoC+vn3+fdy+XL5K/cr",
            format="pcm"
        )
    ]

    for sample in samples:
        assert get_audio_format_from_base64(sample.enc_data) == sample.format
