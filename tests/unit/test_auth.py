import pytest

from phoenix.auth import (
    validate_email_format,
    validate_password_format,
)


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


class TestEmailSanitization:
    """Test the sanitize_email function."""

    def test_sanitize_email_lowercase(self) -> None:
        """Test that sanitize_email converts uppercase to lowercase."""
        from phoenix.auth import sanitize_email

        test_cases = [
            ("test@example.com", "test@example.com"),  # already lowercase
            ("TEST@EXAMPLE.COM", "test@example.com"),  # all uppercase
            ("Test@Example.Com", "test@example.com"),  # mixed case
            ("USER@DOMAIN.ORG", "user@domain.org"),  # different domain
        ]

        for input_email, expected in test_cases:
            result = sanitize_email(input_email)
            assert result == expected, (
                f"sanitize_email('{input_email}') should return '{expected}', but got '{result}'"
            )

    def test_sanitize_email_trim_whitespace(self) -> None:
        """Test that sanitize_email trims whitespace."""
        from phoenix.auth import sanitize_email

        test_cases = [
            ("  test@example.com  ", "test@example.com"),
            ("\tuser@domain.org\n", "user@domain.org"),
            ("   UPPER@CASE.COM   ", "upper@case.com"),
            (" \t MIXED@WHITESPACE.NET \n ", "mixed@whitespace.net"),
        ]

        for input_email, expected in test_cases:
            result = sanitize_email(input_email)
            assert result == expected, (
                f"sanitize_email('{repr(input_email)}') should return '{expected}', "
                f"but got '{result}'"
            )

    def test_sanitize_email_combined(self) -> None:
        """Test that sanitize_email handles both case and whitespace."""
        from phoenix.auth import sanitize_email

        # Test comprehensive sanitization
        messy_email = "  \t TEST.USER@EXAMPLE.COM \n  "
        expected = "test.user@example.com"
        result = sanitize_email(messy_email)

        assert result == expected, (
            f"sanitize_email should handle both case and whitespace: "
            f"expected '{expected}', but got '{result}'"
        )

    def test_sanitize_email_empty_and_edge_cases(self) -> None:
        """Test edge cases for sanitize_email."""
        from phoenix.auth import sanitize_email

        test_cases = [
            ("", ""),  # empty string
            ("   ", ""),  # only whitespace
            ("a@b.c", "a@b.c"),  # minimal valid email
            ("  A@B.C  ", "a@b.c"),  # minimal with whitespace and case
        ]

        for input_email, expected in test_cases:
            result = sanitize_email(input_email)
            assert result == expected, (
                f"sanitize_email('{repr(input_email)}') should return '{expected}', "
                f"but got '{result}'"
            )


class TestPasswordPolicy:
    """Test the configurable password policy."""

    def test_default_policy_accepts_short_password(self) -> None:
        """Default policy only requires 4 characters."""
        validate_password_format("abcd")

    def test_default_policy_rejects_too_short(self) -> None:
        """Default policy rejects passwords under 4 characters."""
        with pytest.raises(ValueError):
            validate_password_format("abc")

    def test_strong_policy_accepts_valid_password(self) -> None:
        """Strong policy accepts a password meeting all requirements."""
        from unittest import mock

        with mock.patch("phoenix.config.get_env_enable_password_policy", return_value=True):
            validate_password_format("StrongPass1!")

    def test_strong_policy_rejects_short_password(self) -> None:
        """Strong policy rejects passwords under 12 characters."""
        from unittest import mock

        with mock.patch("phoenix.config.get_env_enable_password_policy", return_value=True):
            with pytest.raises(ValueError, match="at least 12 characters"):
                validate_password_format("Short1!")

    def test_strong_policy_rejects_missing_uppercase(self) -> None:
        """Strong policy rejects passwords without uppercase letters."""
        from unittest import mock

        with mock.patch("phoenix.config.get_env_enable_password_policy", return_value=True):
            with pytest.raises(ValueError, match="uppercase"):
                validate_password_format("strongpass12!")

    def test_strong_policy_rejects_missing_lowercase(self) -> None:
        """Strong policy rejects passwords without lowercase letters."""
        from unittest import mock

        with mock.patch("phoenix.config.get_env_enable_password_policy", return_value=True):
            with pytest.raises(ValueError, match="lowercase"):
                validate_password_format("STRONGPASS12!")

    def test_strong_policy_rejects_missing_digit(self) -> None:
        """Strong policy rejects passwords without digits."""
        from unittest import mock

        with mock.patch("phoenix.config.get_env_enable_password_policy", return_value=True):
            with pytest.raises(ValueError, match="digit"):
                validate_password_format("StrongPasswd!")

    def test_strong_policy_rejects_missing_special_char(self) -> None:
        """Strong policy rejects passwords without special characters."""
        from unittest import mock

        with mock.patch("phoenix.config.get_env_enable_password_policy", return_value=True):
            with pytest.raises(ValueError, match="special character"):
                validate_password_format("StrongPass123")
