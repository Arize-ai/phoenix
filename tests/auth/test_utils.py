import asyncio

import pytest

from phoenix.auth.utils import compute_password_hash


@pytest.mark.parametrize(
    "password0, password1, salt0, salt1",
    (
        pytest.param("password0", "password1", "salt0", "salt1", id="simple-passwords-and-salts"),
        pytest.param(
            "abcdefghijklmnopqrstuvwxyz",
            "0123456789",
            "qwertyuiop",
            "asdfghjkl",
            id="random-passwords-and-salts",
        ),
    ),
)
async def test_compute_password_hash_produces_same_hash_iff_password_and_salt_are_the_same(
    password0: str, password1: str, salt0: str, salt1: str
) -> None:
    loop = asyncio.get_running_loop()
    password0_salt0_hash0, password0_salt0_hash1, password1_salt0_hash0, password0_salt1_hash0 = [
        await loop.run_in_executor(
            executor=None, func=lambda: compute_password_hash(password, salt)
        )
        for password, salt in (
            (password0, salt0),
            (password0, salt0),
            (password1, salt0),
            (password0, salt1),
        )
    ]
    assert (
        password0_salt0_hash0 == password0_salt0_hash1
    ), "same password and salt should result in the same hash"
    assert (
        password0_salt0_hash0 != password1_salt0_hash0
    ), "different passwords should result in different hashes"
    assert (
        password0_salt0_hash0 != password0_salt1_hash0
    ), "different salts should result in different hashes"
