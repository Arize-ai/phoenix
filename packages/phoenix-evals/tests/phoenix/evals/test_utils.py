import base64
import io
import wave

import lameenc

from phoenix.evals.utils import NOT_PARSABLE, get_audio_format_from_base64, snap_to_rail

PCM_ENC_STR = "cvhy+AT7BPsP/w//VgJWAhoBGgHyAPIAOgE6AdAA0ACA/4D/Nvs2+735vfkC+AL4EfYR9izy"
"LPLZ9dn1AvoC+vn3+fdy+XL5K/cr"
PCM_BYTES = base64.b64decode(PCM_ENC_STR)

SAMPLE_RATE = 44100
CHANNELS = 1
SAMPLE_WIDTH = 2
BITRATE = 128


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


def test_get_audio_format_from_base64_wav():
    buffer = io.BytesIO()

    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(CHANNELS)
        wav_file.setsampwidth(SAMPLE_WIDTH)
        wav_file.setframerate(SAMPLE_RATE)
        wav_file.writeframes(PCM_BYTES)

    wav_bytes = buffer.getvalue()
    wav_base64 = base64.b64encode(wav_bytes).decode("utf-8")

    assert get_audio_format_from_base64(wav_base64) == "wav"


def test_get_audio_format_from_base64_mp3():
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(BITRATE)
    encoder.set_in_sample_rate(SAMPLE_RATE)
    encoder.set_channels(CHANNELS)
    encoder.set_quality(2)

    mp3_bytes = encoder.encode(PCM_BYTES)
    mp3_bytes += encoder.flush()

    mp3_base64 = base64.b64encode(mp3_bytes).decode("utf-8")

    assert get_audio_format_from_base64(mp3_base64) == "mp3"


def test_get_audio_format_from_base64_unsupported():
    try:
        assert get_audio_format_from_base64(PCM_ENC_STR) is None
    except ValueError as e:
        assert str(e) == "Unsupported audio format. Only wav and mp3 are supported."
