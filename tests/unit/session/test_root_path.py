from unittest.mock import patch

import pytest

from phoenix.session.session import launch_app


@pytest.mark.parametrize(
    "root_path,env_var,expected",
    [
        ("/test/proxy", None, "/test/proxy"),
        ("test/proxy", None, "/test/proxy"),
        ("test/proxy/", None, "/test/proxy"),
        ("/", None, "/"),
        (None, "/env/path", "/env/path"),
        ("", "/env/path", ""),  # Test empty string is preserved
        (None, None, ""),
        (None, "", ""),
    ],
)
def test_launch_app_root_path_parameter_flow(
    monkeypatch: pytest.MonkeyPatch,
    root_path: str,
    env_var: str,
    expected: str,
) -> None:
    if env_var is None:
        monkeypatch.delenv("PHOENIX_HOST_ROOT_PATH", raising=False)
    else:
        monkeypatch.setenv("PHOENIX_HOST_ROOT_PATH", env_var)

    with (
        patch("phoenix.session.session.ensure_working_dir_if_needed"),
        patch("phoenix.session.session.ThreadServer") as mock_server,
    ):
        launch_app(root_path=root_path, run_in_thread=True)
        mock_server.assert_called_once()
        call_kwargs = mock_server.call_args[1]
        assert call_kwargs["root_path"] == expected
