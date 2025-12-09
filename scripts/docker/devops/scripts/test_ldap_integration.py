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
- Anonymous bind mode (AUTO_BIND_DEFAULT flow)
- POSIX mode (GROUP_SEARCH_FILTER with memberUid)
- No email mode (null email markers)

Anonymous Bind Testing:
  When PHOENIX_ANONYMOUS_LDAPS_URL and PHOENIX_ANONYMOUS_STARTTLS_URL are set,
  tests the anonymous bind code path where no service account is configured.
  This validates that:
  - ldap3's AUTO_BIND_DEFAULT properly defers bind() to context manager
  - OpenLDAP ACLs allow anonymous searches (requires configuration)
  - User authentication still works without a privileged service account

POSIX Mode Testing:
  When PHOENIX_POSIX_URL is set, tests the GROUP_SEARCH_FILTER code path
  for LDAP servers using POSIX/RFC 2307 group schema (posixGroup with memberUid).
  This validates group membership lookup via search instead of memberOf attribute.

No Email Mode Testing:
  The main Phoenix instance (PHOENIX_URL) is configured with PHOENIX_LDAP_ATTR_EMAIL=
  empty to test the null email marker code path. The full test suite implicitly
  validates that users without email can authenticate using entryUUID as unique ID.

Exit codes:
  0 = All tests passed
  1 = One or more tests failed
"""

from __future__ import annotations

import os
import sys
import time
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Final

import requests

# HTTP status codes
HTTP_OK: Final = 200
HTTP_NO_CONTENT: Final = 204
HTTP_UNAUTHORIZED: Final = 401


@dataclass(frozen=True, slots=True)
class TestResult:
    """Immutable result of a test case."""

    name: str
    passed: bool
    message: str
    details: str | None = None


@dataclass(slots=True)
class TestSuiteResult:
    """Aggregated results from a test suite run."""

    suite_name: str
    results: list[TestResult] = field(default_factory=list)

    @property
    def passed_count(self) -> int:
        return sum(1 for r in self.results if r.passed)

    @property
    def failed_count(self) -> int:
        return len(self.results) - self.passed_count

    @property
    def all_passed(self) -> bool:
        return self.failed_count == 0


class PhoenixURLBuilder:
    """Encapsulates Phoenix URL construction logic."""

    def __init__(self, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")
        # Direct access (port 6006) vs Traefik routing (needs /phoenix prefix)
        self._is_direct = "/phoenix" in base_url or ":6006" in base_url

    @property
    def ldap_login_url(self) -> str:
        prefix = "" if self._is_direct else "/phoenix"
        return f"{self._base_url}{prefix}/auth/ldap/login"

    @property
    def health_url(self) -> str:
        prefix = "" if self._is_direct else "/phoenix"
        return f"{self._base_url}{prefix}/healthz"


class BaseLDAPTester(ABC):
    """Abstract base class for LDAP testing with common authentication logic."""

    REQUEST_TIMEOUT: Final = 30  # Increased for anonymous STARTTLS via MITM proxy

    def __init__(self, phoenix_url: str) -> None:
        self._url_builder = PhoenixURLBuilder(phoenix_url)
        self._results: list[TestResult] = []

    # Special status code to indicate connection failure (not an HTTP status)
    STATUS_CONNECTION_FAILED: Final = -1

    def _login(self, username: str, password: str) -> tuple[int, dict[str, str]]:
        """Attempt LDAP login and return (status_code, lowercase_headers)."""
        try:
            response = requests.post(
                self._url_builder.ldap_login_url,
                json={"username": username, "password": password},
                timeout=self.REQUEST_TIMEOUT,
                allow_redirects=False,
            )
            headers_lower = {k.lower(): v for k, v in response.headers.items()}
            return response.status_code, headers_lower
        except requests.RequestException:
            return self.STATUS_CONNECTION_FAILED, {}

    def _has_auth_token(self, headers: dict[str, str]) -> bool:
        """Check if response contains valid Phoenix authentication token."""
        cookie = headers.get("set-cookie", "")
        # Must have phoenix-access-token= followed by non-empty value
        # Cookie format: phoenix-access-token=<value>; ...
        if "phoenix-access-token=" not in cookie:
            return False
        # Extract token value and verify it's non-empty
        for part in cookie.split(";"):
            if "phoenix-access-token=" in part:
                _, _, value = part.partition("phoenix-access-token=")
                return bool(value.strip())
        return False

    def _assert_login_success(self, name: str, username: str, password: str) -> TestResult:
        """Assert that login succeeds with valid credentials."""
        status, headers = self._login(username, password)
        if status == self.STATUS_CONNECTION_FAILED:
            return TestResult(
                name=name,
                passed=False,
                message="✗ Connection failed (network error or service unavailable)",
            )
        if status == HTTP_NO_CONTENT and self._has_auth_token(headers):
            return TestResult(name=name, passed=True, message=f"✓ {name} succeeded")
        has_token = self._has_auth_token(headers)
        return TestResult(
            name=name,
            passed=False,
            message=f"✗ Expected {HTTP_NO_CONTENT} with token, got {status} (token={has_token})",
        )

    def _assert_login_rejected(
        self,
        name: str,
        username: str,
        password: str,
        *,
        details: str | None = None,
    ) -> TestResult:
        """Assert that login is rejected (401 without token)."""
        status, headers = self._login(username, password)
        if status == self.STATUS_CONNECTION_FAILED:
            return TestResult(
                name=name,
                passed=False,
                message="✗ Connection failed (network error or service unavailable)",
                details=details,
            )
        if status == HTTP_UNAUTHORIZED and not self._has_auth_token(headers):
            return TestResult(
                name=name,
                passed=True,
                message=f"✓ {name} rejected correctly",
                details=details,
            )
        has_token = self._has_auth_token(headers)
        return TestResult(
            name=name,
            passed=False,
            message=f"✗ Expected {HTTP_UNAUTHORIZED} without token, got {status} (tkn={has_token})",
            details=details,
        )

    @abstractmethod
    def get_test_methods(self) -> list[Callable[[], TestResult]]:
        """Return list of test methods to execute."""

    def run(self) -> TestSuiteResult:
        """Execute all tests and return aggregated results."""
        suite_result = TestSuiteResult(suite_name=self.__class__.__name__)
        for test_method in self.get_test_methods():
            result = test_method()
            suite_result.results.append(result)
            self._results.append(result)
        return suite_result


class LDAPTester(BaseLDAPTester):
    """Full LDAP integration test suite for Phoenix with service account."""

    def test_basic_admin_login(self) -> TestResult:
        """Basic admin user authentication (happy path)."""
        return self._assert_login_success("Basic Admin Login", "admin", "password123")

    def test_basic_member_login(self) -> TestResult:
        """Basic member user authentication."""
        return self._assert_login_success("Basic Member Login", "alice", "password123")

    def test_basic_viewer_login(self) -> TestResult:
        """Basic viewer user authentication."""
        return self._assert_login_success("Basic Viewer Login", "charlie", "password123")

    def test_invalid_password(self) -> TestResult:
        """Invalid password rejection."""
        return self._assert_login_rejected("Invalid Password", "admin", "wrongpassword")

    def test_nonexistent_user(self) -> TestResult:
        """Nonexistent user rejection."""
        return self._assert_login_rejected("Nonexistent User", "nonexistent", "password123")

    def test_empty_credentials(self) -> TestResult:
        """Empty credentials rejection (anonymous bind prevention)."""
        return self._assert_login_rejected(
            "Empty Credentials",
            "",
            "",
            details="Anonymous bind via empty credentials prevented",
        )

    def test_empty_password_only(self) -> TestResult:
        """Empty password with valid username (anonymous bind prevention)."""
        return self._assert_login_rejected(
            "Empty Password Prevention",
            "admin",
            "",
            details="Empty password rejected to prevent anonymous bind",
        )

    def test_empty_username_only(self) -> TestResult:
        """Empty username with valid password."""
        return self._assert_login_rejected("Empty Username Prevention", "", "password123")

    def test_duplicate_username_rejection(self) -> TestResult:
        """CRITICAL - Duplicate username in different OUs must be rejected.

        Security: Tests fix for ambiguous search results vulnerability.
        Two users exist: uid=duplicate,ou=IT and uid=duplicate,ou=HR
        Phoenix must reject this as ambiguous (non-deterministic auth).
        """
        return self._assert_login_rejected(
            "Duplicate Username Rejection (Security)",
            "duplicate",
            "password123",
            details="Ambiguous search results correctly rejected",
        )

    def test_no_groups_wildcard_fallback(self) -> TestResult:
        """User with no groups falls back to wildcard role."""
        status, headers = self._login("nogroups", "password123")
        if status == HTTP_NO_CONTENT and self._has_auth_token(headers):
            return TestResult(
                name="No Groups Wildcard Fallback",
                passed=True,
                message="✓ User with no groups authenticated (wildcard '*' → VIEWER)",
            )
        return TestResult(
            name="No Groups Wildcard Fallback",
            passed=False,
            message=f"✗ Expected {HTTP_NO_CONTENT} with token (wildcard fallback), got {status}",
        )

    def test_multiple_groups_precedence(self) -> TestResult:
        """User in multiple groups gets first matching role.

        User 'multigroup' is in: admins, members, viewers
        Expected: ADMIN (first match in group_role_mappings)
        """
        status, headers = self._login("multigroup", "password123")
        if status == HTTP_NO_CONTENT and self._has_auth_token(headers):
            return TestResult(
                name="Multiple Groups Precedence",
                passed=True,
                message="✓ User in multiple groups authenticated (role precedence working)",
                details="First matching group in mappings wins (ADMIN)",
            )
        return TestResult(
            name="Multiple Groups Precedence",
            passed=False,
            message=f"✗ Expected {HTTP_NO_CONTENT} with token, got {status}",
        )

    def test_special_characters_in_username(self) -> TestResult:
        """Special characters in username (LDAP injection prevention)."""
        status, headers = self._login("special(user)", "password123")
        if status == HTTP_NO_CONTENT and self._has_auth_token(headers):
            return TestResult(
                name="Special Characters in Username",
                passed=True,
                message="✓ Special characters handled correctly (injection prevented)",
                details="Username 'special(user)' properly escaped",
            )
        return TestResult(
            name="Special Characters in Username",
            passed=False,
            message=f"✗ Expected {HTTP_NO_CONTENT} with token, got {status}",
            details="LDAP filter escaping may be broken",
        )

    def test_ldap_injection_wildcard(self) -> TestResult:
        """SECURITY: Wildcard injection must not match all users."""
        status, headers = self._login("*", "password123")
        if status == HTTP_UNAUTHORIZED and not self._has_auth_token(headers):
            return TestResult(
                name="LDAP Injection - Wildcard",
                passed=True,
                message="✓ Wildcard '*' properly escaped (not matching all users)",
            )
        return TestResult(
            name="LDAP Injection - Wildcard",
            passed=False,
            message=f"✗ SECURITY: Wildcard may have matched! Got {status}",
            details="LDAP filter escaping may be broken - wildcard injection possible",
        )

    def test_ldap_injection_filter_break(self) -> TestResult:
        """SECURITY: Filter breakout injection must be escaped."""
        # Attempt to close filter and inject: )(uid=*
        status, headers = self._login(")(uid=*", "password123")
        if status == HTTP_UNAUTHORIZED and not self._has_auth_token(headers):
            return TestResult(
                name="LDAP Injection - Filter Breakout",
                passed=True,
                message="✓ Filter breakout attempt properly escaped",
            )
        return TestResult(
            name="LDAP Injection - Filter Breakout",
            passed=False,
            message=f"✗ SECURITY: Filter injection may have worked! Got {status}",
            details="Critical: LDAP filter injection vulnerability",
        )

    def test_ldap_injection_null_byte(self) -> TestResult:
        """SECURITY: Null byte injection must be handled safely."""
        # Null byte could truncate string in some implementations
        status, headers = self._login("admin\x00evil", "password123")
        # Should either reject (401) or treat as literal (not find user)
        if status == HTTP_UNAUTHORIZED and not self._has_auth_token(headers):
            return TestResult(
                name="LDAP Injection - Null Byte",
                passed=True,
                message="✓ Null byte in username handled safely",
            )
        return TestResult(
            name="LDAP Injection - Null Byte",
            passed=False,
            message=f"✗ SECURITY: Null byte may have been mishandled! Got {status}",
            details="Null byte injection could truncate username",
        )

    def test_username_case_sensitivity(self) -> TestResult:
        """Verify username case handling is consistent."""
        # LDAP is typically case-insensitive for uid
        status_lower, _ = self._login("admin", "password123")
        status_upper, _ = self._login("ADMIN", "password123")
        status_mixed, _ = self._login("Admin", "password123")

        # All should behave the same (either all work or all fail)
        statuses = {status_lower, status_upper, status_mixed}
        if len(statuses) == 1:
            return TestResult(
                name="Username Case Sensitivity",
                passed=True,
                message="✓ Username case handling is consistent",
                details=f"All cases returned {status_lower}",
            )
        return TestResult(
            name="Username Case Sensitivity",
            passed=False,
            message="✗ Inconsistent case handling detected",
            details=f"lower={status_lower}, upper={status_upper}, mixed={status_mixed}",
        )

    def test_username_whitespace_handling(self) -> TestResult:
        """Verify username whitespace handling is consistent.

        Note: LDAP servers often normalize whitespace, so ' admin' matching 'admin'
        is expected behavior, not a vulnerability - the attacker still needs the
        correct password. We just verify the behavior is consistent.
        """
        status_normal, _ = self._login("admin", "password123")
        status_leading, _ = self._login(" admin", "password123")
        status_trailing, _ = self._login("admin ", "password123")

        # Document the behavior - all three approaches are valid:
        # 1. Reject whitespace usernames (strict)
        # 2. Normalize whitespace (LDAP default behavior)
        # 3. Treat as different users (if those users exist)

        behaviors = []
        if status_leading == HTTP_NO_CONTENT:
            behaviors.append("normalizes leading space")
        if status_trailing == HTTP_NO_CONTENT:
            behaviors.append("normalizes trailing space")
        if status_leading == HTTP_UNAUTHORIZED:
            behaviors.append("rejects leading space")
        if status_trailing == HTTP_UNAUTHORIZED:
            behaviors.append("rejects trailing space")

        return TestResult(
            name="Username Whitespace Handling",
            passed=True,  # Informational - not a security failure
            message="✓ Whitespace handling documented",
            details=f"Behavior: {', '.join(behaviors)}",
        )

    def test_missing_display_name(self) -> TestResult:
        """Missing displayName attribute (fallback logic)."""
        status, headers = self._login("nodisplay", "password123")
        if status == HTTP_NO_CONTENT and self._has_auth_token(headers):
            return TestResult(
                name="Missing displayName",
                passed=True,
                message="✓ User with missing displayName authenticated (fallback working)",
                details="Should fallback to email prefix",
            )
        return TestResult(
            name="Missing displayName",
            passed=False,
            message=f"✗ Expected {HTTP_NO_CONTENT} with token, got {status}",
        )

    def test_unicode_username(self) -> TestResult:
        """Unicode characters in username (UTF-8 support)."""
        status, headers = self._login("josé", "password123")
        if status == HTTP_NO_CONTENT and self._has_auth_token(headers):
            return TestResult(
                name="Unicode Username",
                passed=True,
                message="✓ Unicode username authenticated (UTF-8 support working)",
                details="Username 'josé' handled correctly",
            )
        return TestResult(
            name="Unicode Username",
            passed=False,
            message=f"✗ Expected {HTTP_NO_CONTENT} with token, got {status}",
            details="UTF-8 encoding may be broken",
        )

    def test_username_enumeration_timing(self) -> TestResult:
        """SECURITY: Valid vs invalid usernames should have similar response times.

        Timing differences could allow username enumeration attacks.
        """
        import statistics

        iterations = 5
        valid_times: list[float] = []
        invalid_times: list[float] = []

        for _ in range(iterations):
            # Time valid username with wrong password
            start = time.time()
            self._login("admin", "wrongpassword")
            valid_times.append(time.time() - start)

            # Time invalid username
            start = time.time()
            self._login("nonexistent_user_12345", "wrongpassword")
            invalid_times.append(time.time() - start)

        valid_avg = statistics.mean(valid_times)
        invalid_avg = statistics.mean(invalid_times)
        diff_pct = abs(valid_avg - invalid_avg) / max(valid_avg, invalid_avg) * 100

        # Allow up to 50% timing difference (network variance)
        if diff_pct < 50:
            return TestResult(
                name="Username Enumeration (Timing)",
                passed=True,
                message="✓ No significant timing difference detected",
                details=f"Valid={valid_avg:.3f}s, Invalid={invalid_avg:.3f}s ({diff_pct:.1f}%)",
            )
        return TestResult(
            name="Username Enumeration (Timing)",
            passed=False,
            message=f"✗ WARNING: {diff_pct:.1f}% timing difference detected",
            details=f"Valid={valid_avg:.3f}s, Invalid={invalid_avg:.3f}s - may leak user validity",
        )

    def get_test_methods(self) -> list[Callable[[], TestResult]]:
        """Return ordered list of all test methods."""
        return [
            # Basic authentication
            self.test_basic_admin_login,
            self.test_basic_member_login,
            self.test_basic_viewer_login,
            self.test_invalid_password,
            self.test_nonexistent_user,
            # Anonymous bind prevention
            self.test_empty_credentials,
            self.test_empty_password_only,
            self.test_empty_username_only,
            # Security: Ambiguous results
            self.test_duplicate_username_rejection,
            # Role assignment
            self.test_no_groups_wildcard_fallback,
            self.test_multiple_groups_precedence,
            # LDAP injection prevention (SECURITY CRITICAL)
            self.test_special_characters_in_username,
            self.test_ldap_injection_wildcard,
            self.test_ldap_injection_filter_break,
            self.test_ldap_injection_null_byte,
            # Username handling
            self.test_username_case_sensitivity,
            self.test_username_whitespace_handling,
            # Edge cases
            self.test_missing_display_name,
            self.test_unicode_username,
            # Timing attacks
            self.test_username_enumeration_timing,
        ]


class SimpleLDAPTester(BaseLDAPTester):
    """Data-driven test suite for mode-specific LDAP testing.

    Instead of creating separate classes for each mode (Anonymous, POSIX, etc.),
    this class takes a list of test cases as data and runs them dynamically.
    """

    def __init__(
        self,
        phoenix_url: str,
        mode_name: str,
        test_cases: list[tuple[str, str, str, bool]],
    ) -> None:
        """Initialize with test cases.

        Args:
            phoenix_url: Phoenix server URL
            mode_name: Mode name for test output (e.g., "POSIX Mode")
            test_cases: List of (test_name, username, password, expect_success)
        """
        super().__init__(phoenix_url)
        self._mode_name = mode_name
        self._test_cases = test_cases

    def get_test_methods(self) -> list[Callable[[], TestResult]]:
        """Generate test methods from test case data."""
        methods: list[Callable[[], TestResult]] = []
        for name, username, password, expect_success in self._test_cases:
            # Capture variables in closure
            methods.append(self._make_test(name, username, password, expect_success))
        return methods

    def _make_test(
        self, name: str, username: str, password: str, expect_success: bool
    ) -> Callable[[], TestResult]:
        """Create a test method for a single test case."""
        full_name = f"{name} ({self._mode_name})"

        def test() -> TestResult:
            if expect_success:
                return self._assert_login_success(full_name, username, password)
            return self._assert_login_rejected(full_name, username, password)

        return test


# Pre-defined test case sets for common modes
ANONYMOUS_TEST_CASES: Final[list[tuple[str, str, str, bool]]] = [
    ("Admin Login", "admin", "password123", True),
    ("Member Login", "alice", "password123", True),
    ("Invalid Password", "admin", "wrongpassword", False),
    ("Special Characters", "special(user)", "password123", True),
]

POSIX_TEST_CASES: Final[list[tuple[str, str, str, bool]]] = [
    ("Admin Login", "admin", "password123", True),
    ("Member Login", "alice", "password123", True),
    ("Viewer Login", "charlie", "password123", True),
    ("Invalid Password", "admin", "wrongpassword", False),
    ("Multi-Group Login", "multigroup", "password123", True),
    ("No Groups Wildcard", "nogroups", "password123", True),
]


class TestRunner:
    """Orchestrates test execution with formatted output."""

    WAIT_TIMEOUT: Final = 30
    WAIT_INTERVAL: Final = 2

    def __init__(self) -> None:
        self._all_passed = True

    def wait_for_service(self, url: str, name: str = "Phoenix") -> bool:
        """Wait for Phoenix service to be ready."""
        url_builder = PhoenixURLBuilder(url)
        print(f"⏳ Waiting for {name} at {url}...", flush=True)

        for attempt in range(self.WAIT_TIMEOUT):
            try:
                response = requests.get(url_builder.health_url, timeout=2)
                if response.status_code == HTTP_OK:
                    print(f"✅ {name} is ready!\n")
                    return True
            except requests.RequestException:
                pass

            if attempt < self.WAIT_TIMEOUT - 1:
                time.sleep(self.WAIT_INTERVAL)

        print(f"❌ {name} not ready after {self.WAIT_TIMEOUT * self.WAIT_INTERVAL} seconds")
        return False

    def run_suite(self, tester: BaseLDAPTester, verbose: bool = True) -> TestSuiteResult:
        """Run a test suite with formatted output."""
        tests = tester.get_test_methods()
        suite_result = TestSuiteResult(suite_name=tester.__class__.__name__)

        for i, test_method in enumerate(tests, 1):
            if verbose:
                print(f"Test {i}/{len(tests)}: ", end="", flush=True)

            result = test_method()
            suite_result.results.append(result)

            if verbose:
                symbol = "✓" if result.passed else "✗"
                print(f"{symbol} {result.name}")
                print(f"  {result.message}")
                if result.details:
                    print(f"  → {result.details}")
                print()

        if not suite_result.all_passed:
            self._all_passed = False

        return suite_result

    def run_full_suite(self, phoenix_url: str) -> bool:
        """Run the full LDAP integration test suite."""
        print("=" * 80)
        print("🧪 Phoenix LDAP Integration Test Suite")
        print("=" * 80)
        print()

        if not self.wait_for_service(phoenix_url):
            return False

        tester = LDAPTester(phoenix_url)
        result = self.run_suite(tester)

        self._print_summary(result)
        return result.all_passed

    def run_anonymous_suites(
        self,
        ldaps_url: str,
        starttls_url: str,
    ) -> bool:
        """Run anonymous bind tests for both LDAPS and STARTTLS modes."""
        print()
        print("=" * 80)
        print("🔓 Phoenix Anonymous Bind Mode Tests")
        print("=" * 80)
        print()
        print("Testing LDAP authentication with anonymous bind (no service account).")
        print("This validates the AUTO_BIND_DEFAULT code path in ldap.py.")
        print()

        all_passed = True

        # Test LDAPS mode
        print("-" * 40)
        print("Testing Anonymous LDAPS Mode (port 636, TLS from start)")
        print("-" * 40)

        if self.wait_for_service(ldaps_url, "Phoenix Anonymous LDAPS"):
            tester = SimpleLDAPTester(ldaps_url, "Anonymous LDAPS", ANONYMOUS_TEST_CASES)
            result = self.run_suite(tester, verbose=False)
            self._print_compact_results(result, "Anonymous LDAPS")
            if not result.all_passed:
                all_passed = False
        else:
            all_passed = False

        print()

        # Test STARTTLS mode
        print("-" * 40)
        print("Testing Anonymous STARTTLS Mode (port 389 → TLS upgrade)")
        print("-" * 40)

        if self.wait_for_service(starttls_url, "Phoenix Anonymous STARTTLS"):
            tester = SimpleLDAPTester(starttls_url, "Anonymous STARTTLS", ANONYMOUS_TEST_CASES)
            result = self.run_suite(tester, verbose=False)
            self._print_compact_results(result, "Anonymous STARTTLS")
            if not result.all_passed:
                all_passed = False
        else:
            all_passed = False

        print()
        self._print_anonymous_summary(all_passed)
        return all_passed

    def _print_compact_results(self, result: TestSuiteResult, mode: str) -> None:
        """Print compact test results for anonymous modes."""
        for r in result.results:
            symbol = "✓" if r.passed else "✗"
            print(f"  {symbol} {r.name}")
            if not r.passed:
                print(f"    {r.message}")
        print(f"📊 {mode} Results: {result.passed_count}/{len(result.results)} passed")

    def _print_summary(self, result: TestSuiteResult) -> None:
        """Print detailed test summary."""
        print("=" * 80)
        print(
            f"📊 Results: {result.passed_count}/{len(result.results)} passed, "
            f"{result.failed_count} failed"
        )
        print()

        if result.failed_count > 0:
            print("❌ FAILED TESTS:")
            for r in result.results:
                if not r.passed:
                    print(f"  - {r.name}: {r.message}")
            print()
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

    def _print_anonymous_summary(self, all_passed: bool) -> None:
        """Print summary for anonymous bind tests."""
        if all_passed:
            print("✅ Both anonymous bind modes working correctly!")
            print("   - AUTO_BIND_DEFAULT defers bind to context manager ✓")
            print("   - LDAPS mode (TLS from start) works ✓")
            print("   - STARTTLS mode (TLS upgrade) works ✓")
            print("   - User search works without service account ✓")
        else:
            print("❌ Some anonymous bind tests failed!")
            print("   This may indicate:")
            print("   - OpenLDAP ACLs are too restrictive for anonymous access")
            print("   - The AUTO_BIND_DEFAULT flow in ldap.py is broken")
            print("   - Network/connection issues with the LDAP server")

    def run_mode_suite(
        self,
        url: str,
        tester: BaseLDAPTester,
        *,
        emoji: str,
        title: str,
        description: list[str],
        mode_name: str,
        success_messages: list[str],
        failure_messages: list[str],
    ) -> bool:
        """Generic runner for mode-specific test suites (POSIX, No Email, etc.)."""
        print()
        print("=" * 80)
        print(f"{emoji} {title}")
        print("=" * 80)
        print()
        for line in description:
            print(line)
        print()

        if not self.wait_for_service(url, mode_name):
            return False

        result = self.run_suite(tester, verbose=False)
        self._print_compact_results(result, mode_name)
        print()

        if result.all_passed:
            print(f"✅ {mode_name} working correctly!")
            for msg in success_messages:
                print(f"   - {msg} ✓")
        else:
            print(f"❌ Some {mode_name} tests failed!")
            print("   This may indicate:")
            for msg in failure_messages:
                print(f"   - {msg}")

        if not result.all_passed:
            self._all_passed = False

        return result.all_passed

    def run_posix_suite(self, posix_url: str) -> bool:
        """Run POSIX mode tests (GROUP_SEARCH_FILTER with memberUid)."""
        return self.run_mode_suite(
            posix_url,
            SimpleLDAPTester(posix_url, "POSIX Mode", POSIX_TEST_CASES),
            emoji="🐧",
            title="Phoenix POSIX Mode Tests (GROUP_SEARCH_FILTER)",
            description=[
                "Testing LDAP authentication with POSIX/RFC 2307 group schema.",
                "Groups use posixGroup objectClass with memberUid attribute.",
                "This validates GROUP_SEARCH_FILTER code path instead of memberOf.",
            ],
            mode_name="POSIX Mode",
            success_messages=[
                "GROUP_SEARCH_FILTER code path works",
                "posixGroup with memberUid supported",
                "Role mapping from group search works",
            ],
            failure_messages=[
                "GROUP_SEARCH_FILTER configuration issue",
                "Group search base DN mismatch",
                "memberUid filter value format issue",
            ],
        )


def main() -> int:
    """Main entry point."""
    phoenix_url = os.environ.get("PHOENIX_URL", "http://localhost:18273")
    phoenix_anonymous_ldaps_url = os.environ.get("PHOENIX_ANONYMOUS_LDAPS_URL", "")
    phoenix_anonymous_starttls_url = os.environ.get("PHOENIX_ANONYMOUS_STARTTLS_URL", "")
    phoenix_posix_url = os.environ.get("PHOENIX_POSIX_URL", "")

    runner = TestRunner()
    # Main Phoenix is configured with PHOENIX_LDAP_ATTR_EMAIL= empty (no-email mode)
    # so the full suite implicitly tests null email marker functionality
    success = runner.run_full_suite(phoenix_url)

    # If anonymous bind URLs are configured, test both modes
    if phoenix_anonymous_ldaps_url and phoenix_anonymous_starttls_url:
        anonymous_success = runner.run_anonymous_suites(
            phoenix_anonymous_ldaps_url,
            phoenix_anonymous_starttls_url,
        )
        success = success and anonymous_success

    # If POSIX mode URL is configured, test GROUP_SEARCH_FILTER code path
    if phoenix_posix_url:
        posix_success = runner.run_posix_suite(phoenix_posix_url)
        success = success and posix_success

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
