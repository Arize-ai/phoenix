from unittest.mock import patch

import pytest

from phoenix.session.session import launch_app


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
) -> None:
    if env_var:
        monkeypatch.setenv("PHOENIX_HOST_ROOT_PATH", env_var)
    else:
        monkeypatch.delenv("PHOENIX_HOST_ROOT_PATH", raising=False)

    with (
        patch("phoenix.session.session.ensure_working_dir_if_needed"),
        patch("phoenix.session.session.ThreadSession") as mock_session,
    ):
        mock_session.return_value.active = True

        launch_app(root_path=root_path, run_in_thread=True)

        mock_session.assert_called_once()
        call_kwargs = mock_session.call_args[1]
        expected = env_var if root_path is None else root_path
        assert call_kwargs["root_path"] == expected
