import base64
import io
import wave

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
    # mp3 sample - starts with ID3 tag header followed by MP3 frame data
    # ID3 header: "ID3" + version + flags + size, then MP3 frame sync 0xFF 0xFB
    audio_base64 = (
        "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAA"
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/7"
        "UMQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/7"
        "UMQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="
    )

    assert get_audio_format_from_base64(audio_base64) == "mp3"


def test_get_audio_format_from_base64_ogg():
    # ogg sample file source: https://commons.wikimedia.org/wiki/File:Example.ogg
    audio_base64 = (
        "T2dnUwACAAAAAAAAAABdwLNHAAAAANYQEycBHgF2b3JiaXMAAAAAAkSsAAAAAAAAA3E"
        "CAAAAAAC4AU9nZ1MAAAAAAAAAAAAAXcCzRwEAAAAHafUAEjb//////////////////"
        "///kQN2b3JiaXMNAAAATGF2ZjU5LjI3LjEwMAEAAAAV"
    )

    assert get_audio_format_from_base64(audio_base64) == "ogg"


def test_get_audio_format_from_base64_flac():
    # flac sample file source: https://helpguide.sony.net/high-res/sample1/v1/en/index.html
    audio_base64 = (
        "ZkxhQwAAACIEgASAAAZyABfyF3ADcAA6aYDl0QDGP1GIkAxmtqagjOLrBAAAlSYAAABy"
        "ZWZlcmVuY2UgbGliRkxBQyAxLjIuMSB3aW42NCAyMDA4MDcwOQUAAAAPAAAAQUxCVU09"
        "QmVlIE1vdmVkDwAAAFRJVExFPUJlZSBNb3ZlZBoAAABBTEJVTUFSVElTVD1CbHVlIE1v"
    )

    assert get_audio_format_from_base64(audio_base64) == "flac"


def test_get_audio_format_from_base64_aac():
    # aac sample file source: https://filesamples.com/formats/aac#google_vignette
    audio_base64 = (
        "//FQgAP//N4EAExhdmM1Ny4xMDcuMTAwAEIgCMEYOP/xUIBxH/whKwwBNFoeYDeQgCQQEQQCg"
        "QCw7jBLFAWFQ2EiTzU874zjjPP3367qpk5b6us556pzg27ZLh4Lmq55jZ41HbEMSU42E7JU4z"
        "trvCOW27IXMf6jZv3vuzszY90MIQk5pqA5B6vbfI/uH1u7xaUtkmEGivxvt+Yvvk+1SduFkxN"
        "10CeFwhOgWT0E62PJ4bBE7dcnZvk8FcJzFEwmJwIMrGqj2/5d33WCxwyU/ZGzoTNFgZUDgAe6P"
        "uHJEjzHYbGiWDWRxjg8Z4nmPFy0E2cadkbE9Y5sVW4+N/8li2+Czwv+3xEzD1H8+TMXiWOc7i7"
        "K9g8b3t3R6nRYN+a5+P+6cA0f5J3J9LzlknK46nCZ434fojbIfoi8LnmNj4fd49Xt44JdWXd/"
    )

    assert get_audio_format_from_base64(audio_base64) == "aac"


def test_get_audio_format_from_base64_m4a():
    # m4a sample file source: https://filesamples.com/formats/m4a
    audio_base64 = (
        "AAAAGGZ0eXBNNEEgAAACAGlzb21pc28yAAAACGZyZWUAGlhHbWRhdN4EAExhdmM1Ny4xMDcuMT"
        "AwAEIgCMEYOCErDAE0Wh5gN5CAJBARBAKBALDuMEsUBYVDYSJPNTzvjOOM8/ffruqmTlvq6znnq"
        "nODbtkuHguarnmNnjUdsQxJTjYTslTjO2u8I5bbshcx/qNm/e+7OzNj3QwhCTmmoDkHq9t8j+4f"
        "W7vFpS2SYQaK/G+35i++T7VJ24WTE3XQJ4XCE6BZPQTrY8nhsETt1ydm+TwVwnMUTCYnAgysaqP"
        "b/l3fdYLHDJT9kbOhM0WBlQOAB7o+4ckSPMdhsaJYNZHGODxnieY8XLQTZxp2RsT1jmxVbj43/y"
        "WLb4LPC/7fETMPUfz5MxeJY5zuLsr2Dxve3dHqdFg35rn4/7pwDR/kncn0vOWScrjqcJnjfh+iN"
        "Za6traBwazT+25On7HByDLP3vgn6H3Pc3Wn0vW3pHT/FX9DCaS/uaZ5ruC5f+em4T9fvLjR+Xx/"
    )

    assert get_audio_format_from_base64(audio_base64) == "m4a"


def test_get_audio_format_from_base64_unsupported():
    try:
        assert get_audio_format_from_base64(PCM_ENC_STR) is None
    except ValueError as e:
        assert (
            str(e)
            == "Unsupported audio format. Supported formats are: mp3, wav, ogg, flac, m4a, aac"
        )
