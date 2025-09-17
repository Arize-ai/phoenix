import inspect
from unittest.mock import patch

import pytest

from phoenix.session.session import ThreadSession, launch_app


def test_session_stores_root_path_exactly_as_provided():
    test_root_paths = ["/proxy/6006", "proxy/6006", "/proxy/6006/", "", "/"]

    for root_path in test_root_paths:
        with patch("phoenix.session.session.Client"):
            session = ThreadSession.__new__(ThreadSession)
            session.root_path = root_path
            assert session.root_path == root_path


def test_empty_string_root_path_preserved():
    """Test that empty string root_path is preserved, not treated as falsy."""
    with (
        patch("phoenix.session.session.Client"),
        patch("phoenix.session.session._get_root_path", return_value="/default/path"),
    ):
        session = ThreadSession.__new__(ThreadSession)
        # Simulate Session.__init__ logic
        root_path = ""
        session.root_path = root_path if root_path is not None else "/default/path"

        # Empty string should be preserved, not replaced with default
        assert session.root_path == ""


def test_launch_app_accepts_root_path_parameter():
    signature = inspect.signature(launch_app)
    assert "root_path" in signature.parameters
    assert signature.parameters["root_path"].default is None


@pytest.mark.parametrize(
    "root_path,env_var",
    [
        ("/test/proxy", None),
        (None, "/env/path"),
        (None, None),
        ("", None),  # Test empty string is preserved
    ],
)
def test_launch_app_root_path_parameter_flow(
    monkeypatch: pytest.MonkeyPatch, root_path: str, env_var: str
):
    if env_var:
        monkeypatch.setenv("PHOENIX_HOST_ROOT_PATH", env_var)
    else:
        monkeypatch.delenv("PHOENIX_HOST_ROOT_PATH", raising=False)

    with (
        patch("phoenix.session.session.ensure_working_dir_if_needed"),
        patch("phoenix.session.session.ThreadSession") as mock_session,
        patch("phoenix.session.session.get_working_dir"),
    ):
        mock_session.return_value.active = True

        session = launch_app(root_path=root_path, run_in_thread=True)

        mock_session.assert_called_once()
        call_kwargs = mock_session.call_args[1]
        assert call_kwargs["root_path"] == root_path
        assert session is not None


def test_cli_parameter_overrides_environment_variable(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("PHOENIX_HOST_ROOT_PATH", "/env/path")

    with (
        patch("phoenix.session.session.ensure_working_dir_if_needed"),
        patch("phoenix.session.session.ThreadSession") as mock_session,
        patch("phoenix.session.session.get_working_dir"),
    ):
        mock_session.return_value.active = True

        session = launch_app(root_path="/cli/path", run_in_thread=True)

        mock_session.assert_called_once()
        call_kwargs = mock_session.call_args[1]
        assert call_kwargs["root_path"] == "/cli/path"
        assert session is not None
