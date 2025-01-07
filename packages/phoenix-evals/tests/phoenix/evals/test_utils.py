import base64
import io
import wave

import lameenc

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

    sample_rate = 44100
    channels = 1
    sample_width = 2
    bitrate = 128

    # Create a BytesIO buffer to hold the WAV data
    buffer = io.BytesIO()

    # Write the WAV header and PCM data
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(sample_width)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_bytes)

    # Get the WAV bytes and encode them as base64
    wav_bytes = buffer.getvalue()
    wav_base64 = base64.b64encode(wav_bytes).decode("utf-8")

    assert get_audio_format_from_base64(wav_base64) == "wav"

    # Create an MP3 encoder using lameenc
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(bitrate)
    encoder.set_in_sample_rate(sample_rate)
    encoder.set_channels(channels)
    encoder.set_quality(2)  # High quality

    # Encode the PCM bytes into MP3 format
    mp3_bytes = encoder.encode(pcm_bytes)
    mp3_bytes += encoder.flush()  # Finish encoding

    # Encode the MP3 bytes as base64
    mp3_base64 = base64.b64encode(mp3_bytes).decode("utf-8")

    assert get_audio_format_from_base64(mp3_base64) == "mp3"

    try:
        assert get_audio_format_from_base64(pcm_enc_str) is None
    except ValueError as e:
        assert str(e) == "Unsupported audio format. Only wav and mp3 are supported."
