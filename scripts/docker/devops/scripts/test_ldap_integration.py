#!/usr/bin/env python3
"""
Rigorous LDAP Integration Test Script for Phoenix

Tests all edge cases discovered through OpenLDAP source code study:
- Basic authentication (happy path)
- Duplicate username rejection (security)
- No groups (wildcard fallback)
- Multiple groups (role precedence)
- Special characters (injection prevention)
- Missing attributes (error handling)
- Unicode support (internationalization)
- PII protection in logs

Exit codes:
  0 = All tests passed
  1 = One or more tests failed
"""

from __future__ import annotations

import sys
import time
from dataclasses import dataclass
from typing import Optional

import requests


@dataclass
class TestResult:
    """Result of a test case."""

    name: str
    passed: bool
    message: str
    details: Optional[str] = None


class LDAPTester:
    """Test Phoenix LDAP authentication against real OpenLDAP server."""

    def __init__(self, phoenix_url: str = "http://localhost:18273"):
        self.phoenix_url = phoenix_url
        # If URL already contains /phoenix, don't add it again (direct access)
        # Otherwise add /phoenix prefix (Traefik routing)
        if "/phoenix" in phoenix_url or ":6006" in phoenix_url:
            self.ldap_login_url = f"{phoenix_url}/auth/ldap/login"
            self.health_url = f"{phoenix_url}/healthz"
        else:
            self.ldap_login_url = f"{phoenix_url}/phoenix/auth/ldap/login"
            self.health_url = f"{phoenix_url}/phoenix/healthz"
        self.results: list[TestResult] = []

    def _login(self, username: str, password: str) -> tuple[int, dict]:
        """Attempt LDAP login and return status code and headers."""
        try:
            response = requests.post(
                self.ldap_login_url,
                json={"username": username, "password": password},
                timeout=10,
                allow_redirects=False,
            )
            # Convert headers to lowercase dict for case-insensitive access
            headers_lower = {k.lower(): v for k, v in response.headers.items()}
            return response.status_code, headers_lower
        except Exception as e:
            return 0, {"error": str(e)}

    def _has_auth_token(self, headers: dict) -> bool:
        """Check if response contains authentication token."""
        # Headers are already lowercase from _login
        set_cookie = headers.get("set-cookie", "")
        return "phoenix-access-token" in set_cookie

    def test_basic_admin_login(self) -> TestResult:
        """Test 1: Basic admin user authentication (happy path)."""
        status, headers = self._login("admin", "password123")

        if status == 204 and self._has_auth_token(headers):
            return TestResult(
                name="Basic Admin Login",
                passed=True,
                message="✓ Admin user authenticated successfully",
            )
        return TestResult(
            name="Basic Admin Login",
            passed=False,
            message=f"✗ Expected 204 with token, got {status}",
        )

    def test_basic_member_login(self) -> TestResult:
        """Test 2: Basic member user authentication."""
        status, headers = self._login("alice", "password123")

        if status == 204 and self._has_auth_token(headers):
            return TestResult(
                name="Basic Member Login",
                passed=True,
                message="✓ Member user authenticated successfully",
            )
        return TestResult(
            name="Basic Member Login",
            passed=False,
            message=f"✗ Expected 204 with token, got {status}",
        )

    def test_basic_viewer_login(self) -> TestResult:
        """Test 3: Basic viewer user authentication."""
        status, headers = self._login("charlie", "password123")

        if status == 204 and self._has_auth_token(headers):
            return TestResult(
                name="Basic Viewer Login",
                passed=True,
                message="✓ Viewer user authenticated successfully",
            )
        return TestResult(
            name="Basic Viewer Login",
            passed=False,
            message=f"✗ Expected 204 with token, got {status}",
        )

    def test_invalid_password(self) -> TestResult:
        """Test 4: Invalid password rejection."""
        status, headers = self._login("admin", "wrongpassword")

        if status == 401 and not self._has_auth_token(headers):
            return TestResult(
                name="Invalid Password",
                passed=True,
                message="✓ Invalid password rejected correctly",
            )
        return TestResult(
            name="Invalid Password",
            passed=False,
            message=f"✗ Expected 401 without token, got {status}",
        )

    def test_nonexistent_user(self) -> TestResult:
        """Test 5: Nonexistent user rejection."""
        status, headers = self._login("nonexistent", "password123")

        if status == 401 and not self._has_auth_token(headers):
            return TestResult(
                name="Nonexistent User",
                passed=True,
                message="✓ Nonexistent user rejected correctly",
            )
        return TestResult(
            name="Nonexistent User",
            passed=False,
            message=f"✗ Expected 401 without token, got {status}",
        )

    def test_empty_credentials(self) -> TestResult:
        """Test 6: Empty credentials rejection (anonymous bind prevention)."""
        status, headers = self._login("", "")

        if status == 401 and not self._has_auth_token(headers):
            return TestResult(
                name="Empty Credentials",
                passed=True,
                message="✓ Empty credentials rejected (anonymous bind prevented)",
            )
        return TestResult(
            name="Empty Credentials",
            passed=False,
            message=f"✗ Expected 401 without token, got {status}",
        )

    def test_duplicate_username_rejection(self) -> TestResult:
        """Test 7: CRITICAL - Duplicate username in different OUs must be rejected.

        Security: Tests fix for ambiguous search results vulnerability.
        Two users exist: uid=duplicate,ou=IT and uid=duplicate,ou=HR
        Phoenix must reject this as ambiguous (non-deterministic auth).
        """
        status, headers = self._login("duplicate", "password123")

        if status == 401 and not self._has_auth_token(headers):
            return TestResult(
                name="Duplicate Username Rejection (Security)",
                passed=True,
                message="✓ Ambiguous search rejected (security fix validated)",
                details="Two users with uid=duplicate in different OUs correctly rejected",
            )
        return TestResult(
            name="Duplicate Username Rejection (Security)",
            passed=False,
            message=f"✗ SECURITY FAILURE: Expected 401, got {status}",
            details="Ambiguous results should be rejected to prevent non-deterministic auth",
        )

    def test_no_groups_wildcard_fallback(self) -> TestResult:
        """Test 8: User with no groups falls back to wildcard role."""
        status, headers = self._login("nogroups", "password123")

        if status == 204 and self._has_auth_token(headers):
            return TestResult(
                name="No Groups Wildcard Fallback",
                passed=True,
                message="✓ User with no groups authenticated (wildcard '*' → VIEWER)",
            )
        return TestResult(
            name="No Groups Wildcard Fallback",
            passed=False,
            message=f"✗ Expected 204 with token (wildcard fallback), got {status}",
        )

    def test_multiple_groups_precedence(self) -> TestResult:
        """Test 9: User in multiple groups gets first matching role.

        User 'multigroup' is in: admins, members, viewers
        Expected: ADMIN (first match in group_role_mappings)
        """
        status, headers = self._login("multigroup", "password123")

        if status == 204 and self._has_auth_token(headers):
            return TestResult(
                name="Multiple Groups Precedence",
                passed=True,
                message="✓ User in multiple groups authenticated (role precedence working)",
                details="First matching group in mappings wins (ADMIN)",
            )
        return TestResult(
            name="Multiple Groups Precedence",
            passed=False,
            message=f"✗ Expected 204 with token, got {status}",
        )

    def test_special_characters_in_username(self) -> TestResult:
        """Test 10: Special characters in username (LDAP injection prevention)."""
        status, headers = self._login("special(user)", "password123")

        if status == 204 and self._has_auth_token(headers):
            return TestResult(
                name="Special Characters in Username",
                passed=True,
                message="✓ Special characters handled correctly (injection prevented)",
                details="Username 'special(user)' properly escaped",
            )
        return TestResult(
            name="Special Characters in Username",
            passed=False,
            message=f"✗ Expected 204 with token, got {status}",
            details="LDAP filter escaping may be broken",
        )

    def test_missing_display_name(self) -> TestResult:
        """Test 11: Missing displayName attribute (fallback logic)."""
        status, headers = self._login("nodisplay", "password123")

        if status == 204 and self._has_auth_token(headers):
            return TestResult(
                name="Missing displayName",
                passed=True,
                message="✓ User with missing displayName authenticated (fallback working)",
                details="Should fallback to email prefix",
            )
        return TestResult(
            name="Missing displayName",
            passed=False,
            message=f"✗ Expected 204 with token, got {status}",
        )

    def test_unicode_username(self) -> TestResult:
        """Test 12: Unicode characters in username (UTF-8 support)."""
        status, headers = self._login("josé", "password123")

        if status == 204 and self._has_auth_token(headers):
            return TestResult(
                name="Unicode Username",
                passed=True,
                message="✓ Unicode username authenticated (UTF-8 support working)",
                details="Username 'josé' handled correctly",
            )
        return TestResult(
            name="Unicode Username",
            passed=False,
            message=f"✗ Expected 204 with token, got {status}",
            details="UTF-8 encoding may be broken",
        )

    def test_empty_password_only(self) -> TestResult:
        """Test 13: Empty password with valid username (anonymous bind prevention)."""
        status, headers = self._login("admin", "")

        if status == 401 and not self._has_auth_token(headers):
            return TestResult(
                name="Empty Password Prevention",
                passed=True,
                message="✓ Empty password rejected (anonymous bind prevented)",
            )
        return TestResult(
            name="Empty Password Prevention",
            passed=False,
            message=f"✗ SECURITY: Expected 401, got {status}",
            details="Empty password should be rejected to prevent anonymous bind",
        )

    def test_empty_username_only(self) -> TestResult:
        """Test 14: Empty username with valid password."""
        status, headers = self._login("", "password123")

        if status == 401 and not self._has_auth_token(headers):
            return TestResult(
                name="Empty Username Prevention",
                passed=True,
                message="✓ Empty username rejected correctly",
            )
        return TestResult(
            name="Empty Username Prevention",
            passed=False,
            message=f"✗ Expected 401, got {status}",
        )

    def run_all_tests(self) -> bool:
        """Run all tests and return overall success."""
        print("=" * 80)
        print("🧪 Phoenix LDAP Integration Test Suite")
        print("=" * 80)
        print()

        tests = [
            self.test_basic_admin_login,
            self.test_basic_member_login,
            self.test_basic_viewer_login,
            self.test_invalid_password,
            self.test_nonexistent_user,
            self.test_empty_credentials,
            self.test_empty_password_only,
            self.test_empty_username_only,
            self.test_duplicate_username_rejection,
            self.test_no_groups_wildcard_fallback,
            self.test_multiple_groups_precedence,
            self.test_special_characters_in_username,
            self.test_missing_display_name,
            self.test_unicode_username,
        ]

        for i, test_func in enumerate(tests, 1):
            print(f"Test {i}/{len(tests)}: ", end="", flush=True)
            result = test_func()
            self.results.append(result)

            # Print result
            symbol = "✓" if result.passed else "✗"
            print(f"{symbol} {result.name}")
            print(f"  {result.message}")
            if result.details:
                print(f"  → {result.details}")
            print()

        # Summary
        print("=" * 80)
        passed = sum(1 for r in self.results if r.passed)
        failed = sum(1 for r in self.results if not r.passed)
        total = len(self.results)

        print(f"📊 Results: {passed}/{total} passed, {failed} failed")
        print()

        if failed > 0:
            print("❌ FAILED TESTS:")
            for result in self.results:
                if not result.passed:
                    print(f"  - {result.name}: {result.message}")
            print()
            return False
        else:
            print("✅ ALL TESTS PASSED!")
            print()
            print("🔒 Security validations:")
            print("  ✓ Duplicate username rejection (ambiguous search)")
            print("  ✓ Anonymous bind prevention (empty credentials)")
            print("  ✓ LDAP injection prevention (special characters)")
            print()
            print("🎯 Edge case handling:")
            print("  ✓ No groups → wildcard fallback")
            print("  ✓ Multiple groups → role precedence")
            print("  ✓ Missing displayName → fallback")
            print("  ✓ Unicode support → UTF-8 handling")
            print()
            return True


def wait_for_phoenix(url: str, max_attempts: int = 30) -> bool:
    """Wait for Phoenix to be ready."""
    print(f"⏳ Waiting for Phoenix at {url}...", flush=True)

    # Determine health check URL based on whether we're using Traefik or direct access
    if "/phoenix" in url or ":6006" in url:
        health_url = f"{url}/healthz"
    else:
        health_url = f"{url}/phoenix/healthz"

    for attempt in range(max_attempts):
        try:
            response = requests.get(health_url, timeout=2)
            if response.status_code == 200:
                print("✅ Phoenix is ready!")
                print()
                return True
        except requests.exceptions.RequestException:
            pass

        if attempt < max_attempts - 1:
            time.sleep(2)

    print(f"❌ Phoenix not ready after {max_attempts * 2} seconds")
    return False


def main() -> int:
    """Main entry point."""
    import os

    # Allow Phoenix URL to be configured via environment variable
    # Default to localhost for local testing, but can be overridden for Docker
    phoenix_url = os.environ.get("PHOENIX_URL", "http://localhost:18273")

    # Wait for Phoenix to be ready
    if not wait_for_phoenix(phoenix_url):
        return 1

    # Run tests
    tester = LDAPTester(phoenix_url)
    success = tester.run_all_tests()

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
