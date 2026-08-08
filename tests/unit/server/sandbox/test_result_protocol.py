from phoenix.server.sandbox.result_protocol import (
    append_framed_result,
    extract_framed_result,
    frame_result,
)


def test_append_and_extract_framed_result() -> None:
    frame = frame_result('{"score": 1}')

    assert append_framed_result("", '{"score": 1}') == frame
    assert append_framed_result("debug", '{"score": 1}') == f"debug\n{frame}"
    assert append_framed_result("debug\n", '{"score": 1}') == f"debug\n{frame}"
    assert extract_framed_result(f"debug\n{frame}") == ('{"score": 1}', "debug")
