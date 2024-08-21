import pytest

from phoenix.auth import validate_email_format, validate_password_format


def test_validate_email_format_does_not_raise_on_valid_format() -> None:
    validate_email_format("user@domain.com")


@pytest.mark.parametrize(
    "email",
    (
        pytest.param("userdomain.com", id="missing-@"),
        pytest.param("user@domain", id="missing-top-level-domain-name"),
        pytest.param("user@domain.", id="empty-top-level-domain-name"),
        pytest.param("user@.com", id="missing-domain-name"),
        pytest.param("@domain.com", id="missing-username"),
        pytest.param("user @domain.com", id="username-contains-space"),
        pytest.param("user@do main.com", id="domain-name-contains-space"),
        pytest.param("user@domain.c om", id="top-level-domain-name-contains-space"),
        pytest.param(" user@domain.com", id="leading-space"),
        pytest.param("user@domain.com ", id="trailing-space"),
        pytest.param(" user@domain.com", id="leading-space"),
        pytest.param("\nuser@domain.com ", id="leading-newline"),
        pytest.param("user@domain.com\n", id="trailing-newline"),
    ),
)
def test_validate_email_format_raises_on_invalid_format(email: str) -> None:
    with pytest.raises(ValueError):
        validate_email_format(email)


def test_validate_password_format_does_not_raise_on_valid_format() -> None:
    validate_password_format("Password1234!")


@pytest.mark.parametrize(
    "password",
    (
        pytest.param("", id="empty"),
        pytest.param("pass word", id="contains-space"),
        pytest.param("pass\nword", id="contains-newline"),
        pytest.param("password\n", id="trailing-newline"),
        pytest.param("P@ßwø®∂!ñ", id="contains-non-ascii-chars"),
        pytest.param("안녕하세요", id="korean"),
        pytest.param("🚀", id="emoji"),
    ),
)
def test_validate_password_format_raises_on_invalid_format(password: str) -> None:
    with pytest.raises(ValueError):
        validate_password_format(password)
