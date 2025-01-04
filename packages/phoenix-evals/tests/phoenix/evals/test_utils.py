import base64
import io

from pydub import AudioSegment

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
    pcm_enc_str = "cvhy+AT7BPsP/w//VgJWAhoBGgHyAPIAOgE6AdAA0ACA/4D/Nvs2+735vfkC+AL4EfYR9izy"
    "LPLZ9dn1AvoC+vn3+fdy+XL5K/cr"

    pcm_bytes = base64.b64decode(pcm_enc_str)
    # 16 bit PCM audio, 44.1 kHz sample rate, mono
    audio_segment = AudioSegment(data=pcm_bytes, sample_width=2, frame_rate=44100, channels=1)

    # Only mp3 and wav formats are currently supported by OpenAI's audio-preview model
    formats = ["mp3", "wav"]
    encoded_audio = {}

    for fmt in formats:
        audio_io = io.BytesIO()
        audio_segment.export(audio_io, format=fmt)
        audio_bytes = audio_io.getvalue()
        encoded_audio[fmt] = base64.b64encode(audio_bytes).decode("utf-8")

    for fmt, enc_str in encoded_audio.items():
        assert fmt == get_audio_format_from_base64(enc_str)
