"""Unit tests for is_reserved_credential_name covering Modal token keys.

These tests assert that MODAL_TOKEN_ID and MODAL_TOKEN_SECRET remain in the
reserved set even after credential_specs is dropped from ModalAdapter (task 3),
because they are anchored in _PHOENIX_SANDBOX_FALLBACK_CREDENTIAL_KEYS.
"""

from __future__ import annotations

import pytest

from phoenix.server.sandbox import is_reserved_credential_name


@pytest.mark.parametrize(
    "name",
    [
        "MODAL_TOKEN_ID",
        "MODAL_TOKEN_SECRET",
        "modal_token_id",
        "modal_token_secret",
        "Modal_Token_Id",
        "Modal_Token_Secret",
    ],
)
def test_modal_token_keys_are_reserved(name: str) -> None:
    assert is_reserved_credential_name(name)


def test_non_modal_reserved_names_still_reserved() -> None:
    assert is_reserved_credential_name("PHOENIX_SANDBOX_TOKEN")
    assert is_reserved_credential_name("PHOENIX_SANDBOX_API_KEY")
    assert is_reserved_credential_name("phoenix_sandbox_token")
