#!/usr/bin/env python3
"""
Comprehensive LDAP TLS Security Test Suite

Validates LDAP TLS implementations by:
1. Testing baseline LDAP connectivity (plaintext, STARTTLS, LDAPS)
2. Testing Phoenix LDAP authentication via MITM proxy (service account mode)
3. Testing Phoenix anonymous bind mode (no service account)
4. Testing Grafana LDAP for comparison
5. Analyzing MITM proxy logs for credential extraction
6. Verifying any extracted credentials actually work

Test strategy:
- Route STARTTLS traffic through adversarial MITM proxy
- Proxy attempts to parse LDAP protocol and extract passwords
- If proxy succeeds → TLS vulnerability detected
- If proxy fails → TLS properly encrypted credentials

Anonymous Bind Mode:
- Tests the AUTO_BIND_DEFAULT flow in ldap.py
- Verifies TLS is established before anonymous bind
- Confirms user password verification also uses TLS

Exit codes:
  0 = All tests passed, no credentials leaked
  1 = Test failures or security vulnerabilities detected
"""

from __future__ import annotations

import logging
import os
import ssl
import sys
import time
from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum, auto
from typing import Final

import requests
from ldap3 import ALL, AUTO_BIND_TLS_BEFORE_BIND, Connection, Server, Tls

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# HTTP status codes
HTTP_OK: Final = 200
HTTP_NO_CONTENT: Final = 204
HTTP_UNAUTHORIZED: Final = 401


class TestPhase(Enum):
    """Test execution phases."""

    BASELINE = auto()
    APPLICATION = auto()
    ADVERSARIAL = auto()


class TestStatus(Enum):
    """Test result status."""

    PASSED = auto()
    FAILED = auto()
    SECURITY_ISSUE = auto()


@dataclass(frozen=True, slots=True)
class TestResult:
    """Immutable test result with rich metadata."""

    name: str
    status: TestStatus
    message: str
    details: str | None = None
    security_impact: str | None = None

    @property
    def passed(self) -> bool:
        """Check if test passed."""
        return self.status == TestStatus.PASSED


@dataclass(frozen=True, slots=True)
class ServiceConfig:
    """Immutable configuration for test services."""

    ldap_host: str
    ldap_port: int
    ldap_bind_dn: str
    ldap_bind_password: str
    phoenix_starttls_url: str
    phoenix_ldaps_url: str
    phoenix_anonymous_ldaps_url: str
    phoenix_anonymous_starttls_url: str
    grafana_url: str
    mitm_api_url: str
    mitm_anonymous_api_url: str  # For anonymous STARTTLS proxy


class LDAPTLSSecurityTester:
    """
    Orchestrates LDAP TLS security tests across multiple services.

    Executes test phases in order:
    1. Baseline - Verify LDAP server works with plaintext/STARTTLS/LDAPS
    2. Application - Test Phoenix and Grafana authentication via MITM proxy
    3. Adversarial - Analyze MITM logs and verify extracted credentials

    Collects all results and determines if any security vulnerabilities exist.
    """

    TEST_TIMEOUT: Final[int] = 30  # Increased for anonymous STARTTLS via MITM proxy
    SERVICE_WAIT_TIMEOUT: Final[int] = 60

    def __init__(self, config: ServiceConfig) -> None:
        self.config = config
        self.results: list[TestResult] = []
        self.stolen_credentials: list[tuple[str, str]] = []
        # Separate credentials by application for granular analysis
        self.phoenix_stolen_credentials: list[tuple[str, str]] = []
        self.grafana_stolen_credentials: list[tuple[str, str]] = []

    def _create_ldap_server(
        self,
        port: int,
        use_ssl: bool,
        use_tls: bool = False,
    ) -> Server:
        """Create LDAP server configuration."""
        tls_config = Tls(validate=ssl.CERT_NONE) if use_tls else None
        return Server(
            self.config.ldap_host,
            port=port,
            use_ssl=use_ssl,
            tls=tls_config,
            get_info=ALL,
        )

    def _test_direct_ldap_connection(
        self,
        name: str,
        port: int,
        use_ssl: bool,
        auto_bind_mode: bool | int,
        description: str,
    ) -> TestResult:
        """Generic direct LDAP connection test."""
        try:
            server = self._create_ldap_server(port, use_ssl, use_tls=True)
            conn = Connection(
                server,
                user=self.config.ldap_bind_dn,
                password=self.config.ldap_bind_password,
                auto_bind=auto_bind_mode,
                raise_exceptions=True,
            )

            if conn.bound:
                conn.unbind()
                return TestResult(
                    name=name,
                    status=TestStatus.PASSED,
                    message=f"✓ {description}",
                    details="Connection succeeded with expected configuration",
                )

            return TestResult(
                name=name,
                status=TestStatus.FAILED,
                message="✗ Connection failed to bind",
            )

        except Exception as e:
            return TestResult(
                name=name,
                status=TestStatus.FAILED,
                message=f"✗ Connection failed: {e}",
            )

    def test_direct_ldap_plaintext(self) -> TestResult:
        """Test plaintext LDAP (baseline)."""
        return self._test_direct_ldap_connection(
            name="Direct LDAP Plaintext",
            port=389,
            use_ssl=False,
            auto_bind_mode=True,
            description="Plaintext connection successful (baseline)",
        )

    def test_direct_ldap_starttls(self) -> TestResult:
        """Test STARTTLS with correct implementation."""
        return self._test_direct_ldap_connection(
            name="Direct LDAP STARTTLS (Correct)",
            port=389,
            use_ssl=False,
            auto_bind_mode=AUTO_BIND_TLS_BEFORE_BIND,
            description="STARTTLS upgrade successful - password encrypted",
        )

    def test_direct_ldap_ldaps(self) -> TestResult:
        """Test LDAPS connection."""
        return self._test_direct_ldap_connection(
            name="Direct LDAP LDAPS",
            port=636,
            use_ssl=True,
            auto_bind_mode=True,
            description="LDAPS connection successful - password encrypted",
        )

    def _test_http_login(
        self,
        name: str,
        url: str,
        payload: dict[str, str],
        expected_status: int,
        description: str,
    ) -> TestResult:
        """Generic HTTP login test."""
        try:
            response = requests.post(
                url,
                json=payload,
                timeout=self.TEST_TIMEOUT,
            )

            if response.status_code == expected_status:
                return TestResult(
                    name=name,
                    status=TestStatus.PASSED,
                    message=f"✓ {description}",
                    details="Authentication routed through MITM proxy for analysis",
                )

            if response.status_code == HTTP_UNAUTHORIZED:
                return TestResult(
                    name=name,
                    status=TestStatus.FAILED,
                    message="✗ Login failed (wrong credentials or config)",
                    security_impact="⚠️  Authentication failed - check configuration",
                )

            return TestResult(
                name=name,
                status=TestStatus.FAILED,
                message=f"✗ Unexpected status: {response.status_code}",
            )

        except requests.RequestException as e:
            return TestResult(
                name=name,
                status=TestStatus.FAILED,
                message=f"✗ Request failed: {e}",
                security_impact="🚨 Cannot connect to service",
            )

    def test_phoenix_starttls(self) -> TestResult:
        """Test Phoenix STARTTLS mode."""
        return self._test_http_login(
            name="Phoenix STARTTLS Mode",
            url=f"{self.config.phoenix_starttls_url}/auth/ldap/login",
            payload={"username": "admin", "password": "password123"},
            expected_status=HTTP_NO_CONTENT,
            description="Login successful via MITM proxy",
        )

    def test_phoenix_ldaps(self) -> TestResult:
        """Test Phoenix LDAPS mode."""
        return self._test_http_login(
            name="Phoenix LDAPS Mode",
            url=f"{self.config.phoenix_ldaps_url}/auth/ldap/login",
            payload={"username": "admin", "password": "password123"},
            expected_status=HTTP_NO_CONTENT,
            description="Login successful via LDAPS",
        )

    def test_phoenix_anonymous_ldaps(self) -> TestResult:
        """Test Phoenix anonymous bind via LDAPS (no service account, TLS from start).

        This tests the AUTO_BIND_DEFAULT flow where:
        1. Connection opened without credentials
        2. TLS established from start (LDAPS mode, port 636)
        3. Anonymous bind() called by context manager
        4. User search performed with anonymous access
        5. User password verified via separate TLS-protected bind
        """
        return self._test_http_login(
            name="Phoenix Anonymous LDAPS Mode",
            url=f"{self.config.phoenix_anonymous_ldaps_url}/auth/ldap/login",
            payload={"username": "admin", "password": "password123"},
            expected_status=HTTP_NO_CONTENT,
            description="Login successful via anonymous LDAPS (AUTO_BIND_DEFAULT)",
        )

    def test_phoenix_anonymous_ldaps_invalid_password(self) -> TestResult:
        """Test Phoenix anonymous LDAPS rejects invalid passwords."""
        return self._test_http_login(
            name="Phoenix Anonymous LDAPS - Invalid Password",
            url=f"{self.config.phoenix_anonymous_ldaps_url}/auth/ldap/login",
            payload={"username": "admin", "password": "wrongpassword"},
            expected_status=HTTP_UNAUTHORIZED,
            description="Invalid password correctly rejected (anonymous LDAPS mode)",
        )

    def test_phoenix_anonymous_starttls(self) -> TestResult:
        """Test Phoenix anonymous bind via STARTTLS (no service account, TLS upgrade).

        This tests the AUTO_BIND_DEFAULT flow where:
        1. Connection opened without credentials
        2. STARTTLS upgrades plaintext to TLS (port 389 → TLS)
        3. Anonymous bind() called by context manager
        4. User search performed with anonymous access
        5. User password verified via separate TLS-protected bind

        Traffic routed through MITM proxy to verify TLS protects user credentials.
        """
        return self._test_http_login(
            name="Phoenix Anonymous STARTTLS Mode",
            url=f"{self.config.phoenix_anonymous_starttls_url}/auth/ldap/login",
            payload={"username": "admin", "password": "password123"},
            expected_status=HTTP_NO_CONTENT,
            description="Login successful via anonymous STARTTLS (AUTO_BIND_DEFAULT)",
        )

    def test_phoenix_anonymous_starttls_invalid_password(self) -> TestResult:
        """Test Phoenix anonymous STARTTLS rejects invalid passwords."""
        return self._test_http_login(
            name="Phoenix Anonymous STARTTLS - Invalid Password",
            url=f"{self.config.phoenix_anonymous_starttls_url}/auth/ldap/login",
            payload={"username": "admin", "password": "wrongpassword"},
            expected_status=HTTP_UNAUTHORIZED,
            description="Invalid password correctly rejected (anonymous STARTTLS mode)",
        )

    def test_grafana_starttls(self) -> TestResult:
        """Test Grafana STARTTLS mode."""
        return self._test_http_login(
            name="Grafana STARTTLS Mode",
            url=f"{self.config.grafana_url}/login",
            payload={"user": "alice", "password": "password123"},
            expected_status=HTTP_OK,
            description="Login successful via MITM proxy",
        )

    def analyze_mitm_proxy_logs(self) -> None:
        """Analyze MITM proxy logs from both proxies to extract stolen credentials."""
        # Query both MITM proxies - main proxy and anonymous proxy
        all_events: list[dict] = []

        for api_url in [self.config.mitm_api_url, self.config.mitm_anonymous_api_url]:
            try:
                response = requests.get(
                    f"{api_url.rstrip('/')}/events",
                    timeout=self.TEST_TIMEOUT,
                )
                response.raise_for_status()
                payload = response.json()
                all_events.extend(payload.get("events", []))
            except requests.RequestException as e:
                logger.warning(f"  (Could not query {api_url}: {e})")

        seen_all: set[tuple[str, str]] = set()
        seen_phoenix: set[tuple[str, str]] = set()
        seen_grafana: set[tuple[str, str]] = set()

        for event in all_events:
            if event.get("event") != "credentials_stolen":
                continue

            dn = event.get("bind_dn")
            password = event.get("password")
            application = event.get("application", "")

            if not dn or not password:
                continue

            credential = (dn, password)
            if credential in seen_all:
                continue

            # Track all credentials for backward compatibility
            self.stolen_credentials.append(credential)
            seen_all.add(credential)

            # Separate by application for granular analysis
            if application.startswith("phoenix-"):
                if credential not in seen_phoenix:
                    self.phoenix_stolen_credentials.append(credential)
                    seen_phoenix.add(credential)
            elif application == "grafana-ldap":
                if credential not in seen_grafana:
                    self.grafana_stolen_credentials.append(credential)
                    seen_grafana.add(credential)
            else:
                # Unknown application - could be Phoenix with failed DNS lookup
                # Treat as potential Phoenix leak for safety (fail-secure)
                logger.warning(f"  ⚠️  Credential stolen from unknown app: {application}")
                if credential not in seen_phoenix:
                    self.phoenix_stolen_credentials.append(credential)
                    seen_phoenix.add(credential)

    def verify_stolen_credentials(self) -> TestResult:
        """Verify extracted credentials actually work (Phoenix only - Grafana is informational)."""
        if not self.stolen_credentials:
            return TestResult(
                name="Phoenix TLS Security Verification",
                status=TestStatus.PASSED,
                message="✓ No credentials extracted by adversary",
                details="MITM proxy was unable to extract any credentials (TLS working)",
            )

        try:
            server = Server(self.config.ldap_host, port=self.config.ldap_port, get_info=ALL)

            # Verify Phoenix credentials (security-critical)
            phoenix_verified = sum(
                1
                for dn, pwd in self.phoenix_stolen_credentials
                if self._verify_single_credential(server, dn, pwd)
            )

            # Verify Grafana credentials (informational only)
            grafana_verified = sum(
                1
                for dn, pwd in self.grafana_stolen_credentials
                if self._verify_single_credential(server, dn, pwd)
            )

            # Only fail if Phoenix leaked credentials
            if phoenix_verified > 0:
                return TestResult(
                    name="Phoenix TLS Security Verification",
                    status=TestStatus.SECURITY_ISSUE,
                    message=(f"🚨 CRITICAL: Phoenix leaked {phoenix_verified} credential(s)"),
                    security_impact=(
                        f"Phoenix transmitted {phoenix_verified} credential(s) in plaintext. "
                        "TLS was not properly configured or implemented."
                    ),
                )

            # Phoenix is secure - Grafana leaks are expected/informational
            details_parts = ["✓ Phoenix: No credentials leaked (TLS working correctly)"]

            if grafana_verified > 0:
                details_parts.append(
                    f"ℹ️  Grafana: {grafana_verified} credential(s) leaked "
                    "(known issue in Grafana v11.4, demonstrates vulnerability)"
                )

            return TestResult(
                name="Phoenix TLS Security Verification",
                status=TestStatus.PASSED,
                message="✓ Phoenix TLS security validated",
                details="\n  ".join(details_parts),
            )

        except Exception as e:
            return TestResult(
                name="Phoenix TLS Security Verification",
                status=TestStatus.FAILED,
                message=f"✗ Verification error: {e}",
            )

    @staticmethod
    def _verify_single_credential(server: Server, dn: str, password: str) -> bool:
        """Verify a single credential."""
        try:
            conn = Connection(server, user=dn, password=password, auto_bind=True)
            if conn.bound:
                conn.unbind()
                return True
        except Exception:
            pass
        return False

    def run_test_phase(
        self,
        phase: TestPhase,
        tests: list[Callable[[], TestResult]],
    ) -> None:
        """Run a phase of tests."""
        phase_names = {
            TestPhase.BASELINE: "Baseline LDAP Connectivity Tests",
            TestPhase.APPLICATION: "Application Security Tests (via MITM Proxy)",
            TestPhase.ADVERSARIAL: "Adversarial Analysis - Credential Extraction",
        }

        logger.info("=" * 80)
        logger.info(f"PHASE {phase.value}: {phase_names[phase]}")
        logger.info("=" * 80)
        logger.info("")

        for i, test_func in enumerate(tests, 1):
            logger.info(f"Test {phase.value}.{i}: {test_func.__doc__}")
            result = test_func()
            self.results.append(result)

            logger.info(f"  {result.message}")
            if result.details:
                logger.info(f"  → {result.details}")
            if result.security_impact:
                logger.info(f"  ⚠️  {result.security_impact}")
            logger.info("")

    def run_all_tests(self) -> bool:
        """Run comprehensive security test suite."""
        logger.info("=" * 80)
        logger.info("🛡️  COMPREHENSIVE LDAP TLS SECURITY TEST SUITE")
        logger.info("=" * 80)
        logger.info("")
        logger.info("This suite performs ADVERSARIAL testing to detect credential leakage:")
        logger.info("  • Routes STARTTLS traffic through MITM proxy")
        logger.info("  • Proxy parses LDAP protocol to extract credentials")
        logger.info("  • Verifies extracted credentials actually work")
        logger.info("")
        logger.info("Security Model:")
        logger.info("  IF proxy extracts working credentials → VULNERABILITY")
        logger.info("  IF proxy gets encrypted data → SECURE")
        logger.info("")

        # Phase 1: Baseline
        self.run_test_phase(
            TestPhase.BASELINE,
            [
                self.test_direct_ldap_plaintext,
                self.test_direct_ldap_starttls,
                self.test_direct_ldap_ldaps,
            ],
        )

        # Phase 2: Applications
        self.run_test_phase(
            TestPhase.APPLICATION,
            [
                self.test_phoenix_starttls,
                self.test_phoenix_ldaps,
                self.test_phoenix_anonymous_ldaps,
                self.test_phoenix_anonymous_ldaps_invalid_password,
                self.test_phoenix_anonymous_starttls,
                self.test_phoenix_anonymous_starttls_invalid_password,
                self.test_grafana_starttls,
            ],
        )

        # Phase 3: Adversarial analysis
        logger.info("=" * 80)
        logger.info("PHASE 3: Adversarial Analysis - Credential Extraction")
        logger.info("=" * 80)
        logger.info("")

        logger.info("Analyzing MITM proxy logs for stolen credentials...")
        self.analyze_mitm_proxy_logs()

        logger.info("")
        logger.info(f"Total credentials extracted: {len(self.stolen_credentials)}")
        logger.info(f"  Phoenix (attributed): {len(self.phoenix_stolen_credentials)}")
        logger.info(f"  Grafana (attributed): {len(self.grafana_stolen_credentials)}")
        # Sanity check: all stolen credentials should be attributed
        unattributed = (
            len(self.stolen_credentials)
            - len(self.phoenix_stolen_credentials)
            - len(self.grafana_stolen_credentials)
        )
        if unattributed > 0:
            # This shouldn't happen since unknown apps are now treated as Phoenix
            logger.warning(f"  ⚠️  Unattributed: {unattributed} (possible attribution bug)")
        logger.info("")

        logger.info("Test 3.1: Verifying Phoenix TLS security...")
        result = self.verify_stolen_credentials()
        self.results.append(result)
        logger.info(f"  {result.message}")
        if result.details:
            for line in result.details.split("\n"):
                logger.info(f"  {line}")
        if result.security_impact:
            logger.info(f"  🚨 {result.security_impact}")
        logger.info("")

        return self._print_final_assessment()

    def _print_final_assessment(self) -> bool:
        """Print final security assessment."""
        logger.info("=" * 80)
        logger.info("📊 FINAL SECURITY ASSESSMENT")
        logger.info("=" * 80)
        logger.info("")

        passed = sum(1 for r in self.results if r.passed)
        failed = len(self.results) - passed

        logger.info(f"Total Tests: {len(self.results)}")
        logger.info(f"Passed: {passed}")
        logger.info(f"Failed: {failed}")
        logger.info("")

        security_issues = [r for r in self.results if r.status == TestStatus.SECURITY_ISSUE]

        if security_issues:
            self._print_security_vulnerabilities(security_issues)
            return False

        # Check if any Phase 2 application tests failed - we can't claim security
        # is verified if we couldn't even connect to test the applications!
        failed_tests = [r for r in self.results if r.status == TestStatus.FAILED]
        if failed_tests:
            self._print_incomplete_verification(failed_tests)
            return False

        self._print_success_summary()
        return True

    def _print_security_vulnerabilities(self, issues: list[TestResult]) -> None:
        """Print security vulnerability details (Phoenix only)."""
        logger.info("=" * 80)
        logger.info("🚨 PHOENIX TLS SECURITY VULNERABILITIES DETECTED")
        logger.info("=" * 80)
        logger.info("")

        for result in issues:
            logger.info(f"❌ {result.name}")
            logger.info(f"   {result.message}")
            if result.security_impact:
                logger.info(f"   {result.security_impact}")
            logger.info("")

        if self.phoenix_stolen_credentials:
            logger.info("PHOENIX STOLEN CREDENTIALS:")
            logger.info("═" * 80)
            for dn, pwd in self.phoenix_stolen_credentials:
                logger.info(f"  DN: {dn}")
                logger.info(f"  Password: {pwd}")
                logger.info("")
            logger.info("═" * 80)

        logger.info("\n⚠️  RECOMMENDATION: Review Phoenix TLS implementation immediately.")
        logger.info("    An attacker on the network can intercept Phoenix credentials.")
        logger.info("")
        logger.info("🔍 For detailed analysis, check MITM proxy logs:")
        logger.info("    docker logs devops-ldap-mitm-proxy")

    def _print_incomplete_verification(self, failed_tests: list[TestResult]) -> None:
        """Print warning when tests couldn't complete - security NOT verified."""
        logger.info("=" * 80)
        logger.info("⚠️  SECURITY VERIFICATION INCOMPLETE")
        logger.info("=" * 80)
        logger.info("")
        logger.info("Some tests failed to connect - cannot verify TLS security!")
        logger.info("A passing result requires ALL application tests to succeed.")
        logger.info("")
        logger.info("Failed tests:")
        for result in failed_tests:
            logger.info(f"  ❌ {result.name}: {result.message}")
            if result.security_impact:
                logger.info(f"     {result.security_impact}")
        logger.info("")
        logger.info("Possible causes:")
        logger.info("  • Service not running or not ready")
        logger.info("  • Network connectivity issues")
        logger.info("  • MITM proxy configuration problem")
        logger.info("")
        logger.info("Fix the issues above and re-run the tests.")
        logger.info("=" * 80)
        logger.info("")

    def _print_success_summary(self) -> None:
        """Print success summary with verification instructions."""
        logger.info("=" * 80)
        logger.info("✅ PHOENIX TLS SECURITY VERIFIED")
        logger.info("=" * 80)
        logger.info("")
        logger.info("Phoenix LDAP TLS Security:")
        logger.info("  ✓ STARTTLS properly encrypts credentials (service account mode)")
        logger.info("  ✓ LDAPS properly encrypts credentials (service account mode)")
        logger.info("  ✓ Anonymous LDAPS mode works correctly (AUTO_BIND_DEFAULT)")
        logger.info("  ✓ Anonymous STARTTLS mode works correctly (AUTO_BIND_DEFAULT)")
        logger.info("  ✓ Anonymous modes reject invalid passwords")
        logger.info("  ✓ Adversarial MITM proxy could not extract Phoenix credentials")
        logger.info("  ✓ Network attacker cannot steal Phoenix passwords")
        logger.info("")

        if self.grafana_stolen_credentials:
            logger.info("Grafana LDAP (Informational - Known Vulnerability):")
            logger.info(f"  ℹ️  Grafana leaked {len(self.grafana_stolen_credentials)} credential(s)")
            logger.info("  ℹ️  This is a known issue in Grafana v11.4")
            logger.info("  ℹ️  Demonstrates the vulnerability that Phoenix prevents")
            logger.info("")

        logger.info("=" * 80)
        logger.info("🔍 MANUAL VERIFICATION")
        logger.info("=" * 80)
        logger.info("")
        logger.info("To verify adversarial MITM proxy results:")
        logger.info("")
        logger.info("1. Check MITM proxy logs:")
        logger.info("   $ docker logs devops-ldap-mitm-proxy")
        logger.info("")
        logger.info("2. Look for:")
        logger.info("   Phoenix: 'TLS handshake detected', 'Credentials extracted: 0'")
        logger.info("   Grafana: 'credentials_stolen' (expected - demonstrates vulnerability)")
        logger.info("")
        logger.info("=" * 80)
        logger.info("")


def _check_service_health(url: str) -> bool:
    """Check if a service is healthy by hitting its health endpoint."""
    try:
        return requests.get(url, timeout=2).status_code == HTTP_OK
    except requests.RequestException:
        return False


def wait_for_services(config: ServiceConfig, max_attempts: int = 30) -> bool:
    """Wait for all services to be ready."""
    logger.info(
        "⏳ Waiting for services (Phoenix STARTTLS, LDAPS, Anonymous LDAPS, "
        "Anonymous STARTTLS, Grafana)..."
    )

    health_endpoints = [
        f"{config.phoenix_starttls_url}/healthz",
        f"{config.phoenix_ldaps_url}/healthz",
        f"{config.phoenix_anonymous_ldaps_url}/healthz",
        f"{config.phoenix_anonymous_starttls_url}/healthz",
        f"{config.grafana_url}/api/health",
    ]

    for attempt in range(max_attempts):
        if all(_check_service_health(url) for url in health_endpoints):
            logger.info("✅ All services ready!\n")
            return True

        if attempt < max_attempts - 1:
            time.sleep(2)

    logger.error(f"❌ Services not ready after {max_attempts * 2} seconds")
    return False


def main() -> int:
    """CLI entry point."""
    config = ServiceConfig(
        ldap_host=os.getenv("LDAP_HOST", "ldap"),
        ldap_port=int(os.getenv("LDAP_PORT", "389")),
        ldap_bind_dn="cn=readonly,dc=example,dc=com",
        ldap_bind_password="readonly_password",
        phoenix_starttls_url=os.getenv("PHOENIX_STARTTLS_URL", "http://phoenix-starttls:6006"),
        phoenix_ldaps_url=os.getenv("PHOENIX_LDAPS_URL", "http://phoenix:6006"),
        phoenix_anonymous_ldaps_url=os.getenv(
            "PHOENIX_ANONYMOUS_LDAPS_URL", "http://phoenix-anonymous-ldaps:6006"
        ),
        phoenix_anonymous_starttls_url=os.getenv(
            "PHOENIX_ANONYMOUS_STARTTLS_URL", "http://phoenix-anonymous-starttls:6006"
        ),
        grafana_url=os.getenv("GRAFANA_URL", "http://grafana-ldap:3000"),
        mitm_api_url=os.getenv("MITM_API_URL", "http://ldap-mitm-proxy:8080"),
        mitm_anonymous_api_url=os.getenv(
            "MITM_ANONYMOUS_API_URL", "http://ldap-anonymous-mitm-proxy:8080"
        ),
    )

    if not wait_for_services(config):
        return 1

    tester = LDAPTLSSecurityTester(config)
    success = tester.run_all_tests()

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
