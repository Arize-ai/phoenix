# ruff: noqa: E501
"""
Authentication error and success message codes.

These codes are used in authentication flows to safely communicate status
to users via query parameters. Using codes instead of raw messages prevents
social engineering and phishing attacks.

The messages are passed to the frontend via window.Config to ensure a single
source of truth between backend and frontend.
"""

from types import MappingProxyType
from typing import Literal, Mapping, get_args

# Error code type - used for type hints in redirect functions
AuthErrorCode = Literal[
    "unknown_idp",
    "auth_failed",
    "invalid_state",
    "unsafe_return_url",
    "oauth_error",
    "no_oidc_support",
    "missing_email_scope",
    "email_in_use",
    "sign_in_not_allowed",
]

# Error messages - passed to frontend via window.Config.authErrorMessages
# Backend generates these codes when redirecting users after OAuth errors
AUTH_ERROR_MESSAGES: Mapping[AuthErrorCode, str] = MappingProxyType(
    {
        "unknown_idp": "Unknown identity provider.",
        "auth_failed": "Authentication failed. Please contact your administrator.",
        "invalid_state": "Invalid authentication state. Please try again.",
        "unsafe_return_url": "Invalid return URL. Please try again.",
        "oauth_error": "Authentication failed. Please try again.",
        "no_oidc_support": "Your identity provider does not appear to support OpenID Connect. Please contact your administrator.",
        "missing_email_scope": "Please ensure your identity provider is configured to use the 'email' scope.",
        "email_in_use": "An account with this email already exists.",
        "sign_in_not_allowed": "Sign in is not allowed. Please contact your administrator.",
    }
)

# Runtime assertion to ensure AUTH_ERROR_MESSAGES keys match AuthErrorCode Literal values
assert set(AUTH_ERROR_MESSAGES.keys()) == set(get_args(AuthErrorCode))
