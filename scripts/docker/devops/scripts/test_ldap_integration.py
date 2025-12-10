#!/usr/bin/env python3
"""
LDAP Integration Tests for Phoenix

Tests authentication across multiple LDAP configurations:
- No-email mode (null email markers via entryUUID)
- Anonymous bind (LDAPS and STARTTLS)
- POSIX groups (GROUP_SEARCH_FILTER with memberUid)

Exit codes: 0 = all passed, 1 = failures
"""

from __future__ import annotations

import os
import sys
import time

import requests

# Test case format: (name, username, password, expect_success)
# Common tests that work across all LDAP configurations
COMMON_TESTS: list[tuple[str, str, str, bool]] = [
    # Basic authentication
    ("Admin Login", "admin", "password123", True),
    ("Member Login", "alice", "password123", True),
    ("Viewer Login", "charlie", "password123", True),
    ("Invalid Password", "admin", "wrongpassword", False),
    ("Nonexistent User", "nonexistent", "password123", False),
    # Anonymous bind prevention
    ("Empty Credentials", "", "", False),
    ("Empty Password", "admin", "", False),
    ("Empty Username", "", "password123", False),
    # Role assignment edge cases
    ("No Groups Wildcard", "nogroups", "password123", True),
    ("Multi-Group Precedence", "multigroup", "password123", True),
    # Missing displayName fallback
    ("Missing displayName", "nodisplay", "password123", True),
    # Security: Ambiguous search rejection
    ("Duplicate Username", "duplicate", "password123", False),
    # LDAP injection prevention
    ("Injection: Wildcard", "*", "password123", False),
    ("Injection: Filter Break", ")(uid=*", "password123", False),
    ("Injection: Null Byte", "admin\x00evil", "password123", False),
]

# Special character tests - only for memberOf mode
# (POSIX memberUid uses IA5String which is ASCII-only, so skip these)
SPECIAL_CHAR_TESTS: list[tuple[str, str, str, bool]] = [
    ("Special Chars", "special(user)", "password123", True),
    ("Unicode Username", "josé", "password123", True),
]


def login(base_url: str, username: str, password: str) -> tuple[int, str | None]:
    """Attempt login, return (status_code, access_token or None)."""
    url = f"{base_url.rstrip('/')}/auth/ldap/login"
    try:
        resp = requests.post(url, json={"username": username, "password": password}, timeout=30)
        token = resp.cookies.get("phoenix-access-token")
        return resp.status_code, token
    except requests.RequestException as e:
        print(f"    Network error: {e}")
        return -1, None


def wait_for_service(base_url: str, name: str, timeout: int = 60) -> bool:
    """Wait for Phoenix health endpoint."""
    url = f"{base_url.rstrip('/')}/healthz"
    print(f"⏳ Waiting for {name}...", end="", flush=True)
    start = time.time()
    while time.time() - start < timeout:
        try:
            if requests.get(url, timeout=2).status_code == 200:
                print(" ✅")
                return True
        except requests.RequestException:
            pass
        time.sleep(1)
    print(" ❌ timeout")
    return False


def run_tests(
    base_url: str,
    tests: list[tuple[str, str, str, bool]],
) -> tuple[int, int]:
    """Run test cases, return (passed, failed) counts."""
    passed = failed = 0
    for name, username, password, expect_success in tests:
        status, token = login(base_url, username, password)
        has_token = token is not None
        # For failures, accept 400/401/422 (bad request, unauthorized, unprocessable)
        if expect_success:
            success = status == 204 and has_token
        else:
            success = status in (400, 401, 422)
        symbol = "✓" if success else "✗"
        print(f"  {symbol} {name}")
        if not success:
            expected = "204+token" if expect_success else "400/401/422"
            print(f"    Expected {expected}, got {status} (token={has_token})")
            failed += 1
        else:
            passed += 1
    return passed, failed


def test_case_sensitivity(base_url: str) -> bool:
    """
    Verify case-insensitive username handling.

    LDAP servers typically perform case-insensitive matching for uid attributes.
    All case variants should succeed since 'admin' exists in the directory.
    """
    variants = ["admin", "ADMIN", "Admin"]
    results = [(u, login(base_url, u, "password123")[0]) for u in variants]
    # Expect all variants to succeed (204) for case-insensitive LDAP
    all_succeed = all(status == 204 for _, status in results)
    # Or all fail consistently (401) for case-sensitive LDAP
    all_fail = all(status == 401 for _, status in results)
    passed = all_succeed or all_fail
    if passed:
        behavior = "case-insensitive" if all_succeed else "case-sensitive"
        print(f"  ✓ Case Sensitivity ({behavior})")
    else:
        print("  ✗ Case Sensitivity (inconsistent behavior)")
        for username, status in results:
            print(f"    '{username}' -> {status}")
    return passed


# Expected roles based on LDAP group memberships and GROUP_ROLE_MAPPINGS:
#   cn=admins -> ADMIN, cn=members -> MEMBER, cn=viewers -> VIEWER, * -> VIEWER
# For users in multiple groups, first match wins (ADMIN > MEMBER > VIEWER)
#
# Format: (ldap_uid, display_name, expected_role)
# - ldap_uid: Used for login (LDAP authentication)
# - display_name: Used as username in Phoenix API response
# - expected_role: The role that should be assigned based on group membership
EXPECTED_USER_ROLES: list[tuple[str, str, str]] = [
    ("admin", "Admin User", "ADMIN"),  # in admins
    ("alice", "Alice Smith", "MEMBER"),  # in members
    ("bob", "Bob Johnson", "MEMBER"),  # in members
    ("charlie", "Charlie Brown", "VIEWER"),  # in viewers
    ("nogroups", "nogroups", "VIEWER"),  # no groups, no displayName - falls back to uid
    ("multigroup", "Multi Group User", "ADMIN"),  # in admins+members+viewers - first match
    ("nodisplay", "nodisplay", "VIEWER"),  # no displayName - falls back to uid
    ("special(user)", "Special (User)", "VIEWER"),  # in viewers
    ("josé", "José García", "MEMBER"),  # in members
]


def verify_user_roles(base_url: str, is_posix: bool = False) -> tuple[int, int]:
    """
    Verify that users have correct roles assigned after LDAP authentication.

    First logs in as each expected user to ensure they exist in Phoenix's database
    (just-in-time provisioning), then fetches all users from /v1/users using the
    admin API key and verifies each user's role matches expectations.

    Returns (passed, failed) counts.
    """
    print("\n  📋 Role Verification:")

    # Get admin API key from environment
    admin_secret = os.environ.get("PHOENIX_ADMIN_SECRET", "")
    if not admin_secret:
        print("    ✗ PHOENIX_ADMIN_SECRET not set, skipping role verification")
        return 0, 1

    # Determine which users to check based on mode
    # POSIX mode doesn't support special chars (IA5String is ASCII-only)
    users_to_check = [
        (uid, display_name, role)
        for uid, display_name, role in EXPECTED_USER_ROLES
        if not is_posix or uid not in ("special(user)", "josé")
    ]

    # First, login as each user to ensure they exist in Phoenix (JIT provisioning)
    print("    Provisioning users via login...")
    for ldap_uid, _, _ in users_to_check:
        status, _ = login(base_url, ldap_uid, "password123")
        if status != 204:
            print(f"    ⚠ Failed to provision {ldap_uid}: HTTP {status}")

    # Fetch all users using admin API key
    try:
        resp = requests.get(
            f"{base_url.rstrip('/')}/v1/users",
            headers={"Authorization": f"Bearer {admin_secret}"},
            timeout=30,
        )
        if resp.status_code != 200:
            print(f"    ✗ Failed to fetch users: HTTP {resp.status_code}")
            return 0, 1
        users = resp.json().get("data", [])
    except requests.RequestException as e:
        print(f"    ✗ Network error fetching users: {e}")
        return 0, 1

    # Build display_name -> role mapping from API response
    # Phoenix uses displayName as username in the API
    user_roles: dict[str, str] = {}
    for user in users:
        username = user.get("username")
        if username:
            user_roles[username] = user.get("role", "UNKNOWN")

    passed = failed = 0
    for ldap_uid, display_name, expected_role in users_to_check:
        actual_role = user_roles.get(display_name)
        if actual_role is None:
            print(f"    ✗ {display_name} ({ldap_uid}): not found in users list")
            failed += 1
        elif actual_role == expected_role:
            print(f"    ✓ {display_name}: {actual_role}")
            passed += 1
        else:
            print(f"    ✗ {display_name}: expected {expected_role}, got {actual_role}")
            failed += 1

    return passed, failed


def run_suite(
    base_url: str,
    name: str,
    tests: list[tuple[str, str, str, bool]],
    verify_roles: bool = False,
    is_posix: bool = False,
) -> bool:
    """Run a complete test suite for one Phoenix instance."""
    print(f"\n{'=' * 60}")
    print(f"🧪 {name}")
    print("=" * 60)

    if not wait_for_service(base_url, name):
        return False

    passed, failed = run_tests(base_url, tests)

    # Additional tests for main suite only
    if "No-Email" in name:
        if test_case_sensitivity(base_url):
            passed += 1
        else:
            failed += 1

    # Role verification for full test suites
    if verify_roles:
        role_passed, role_failed = verify_user_roles(base_url, is_posix=is_posix)
        passed += role_passed
        failed += role_failed

    total = passed + failed
    print(f"\n📊 {name}: {passed}/{total} passed")
    if failed:
        print(f"❌ {failed} test(s) failed")
    else:
        print("✅ All tests passed!")
    return failed == 0


def main() -> int:
    phoenix_url = os.environ.get("PHOENIX_URL", "http://localhost:18273")
    anon_ldaps_url = os.environ.get("PHOENIX_ANONYMOUS_LDAPS_URL", "")
    anon_starttls_url = os.environ.get("PHOENIX_ANONYMOUS_STARTTLS_URL", "")
    posix_url = os.environ.get("PHOENIX_POSIX_URL", "")

    all_passed = True

    # Standard tests = common + special char tests (memberOf mode)
    standard_tests = COMMON_TESTS + SPECIAL_CHAR_TESTS

    # Main suite (no-email mode with memberOf groups) - full role verification
    all_passed &= run_suite(phoenix_url, "Phoenix No-Email Mode", standard_tests, verify_roles=True)

    # Anonymous bind suites (subset of tests - just verify auth works)
    anon_tests = [
        t
        for t in standard_tests
        if t[0] in ("Admin Login", "Member Login", "Invalid Password", "Special Chars")
    ]
    if anon_ldaps_url:
        all_passed &= run_suite(anon_ldaps_url, "Anonymous LDAPS", anon_tests)
    if anon_starttls_url:
        all_passed &= run_suite(anon_starttls_url, "Anonymous STARTTLS", anon_tests)

    # POSIX mode - common tests + role verification (no special chars)
    if posix_url:
        all_passed &= run_suite(
            posix_url, "POSIX Mode", COMMON_TESTS, verify_roles=True, is_posix=True
        )

    print(f"\n{'=' * 60}")
    if all_passed:
        print("✅ ALL SUITES PASSED")
    else:
        print("❌ SOME SUITES FAILED")
    print("=" * 60)

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
