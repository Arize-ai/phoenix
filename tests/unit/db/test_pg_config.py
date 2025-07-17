import ssl
from typing import Literal

import pytest
from smtpdfix.certs import Cert, _generate_certs
from sqlalchemy import make_url

from phoenix.db.pg_config import get_pg_config

BASE = make_url("postgresql://postgres:phoenix@localhost:5432/postgres")


class TestPgConfig:
    @pytest.fixture
    def _tls_certs_client(
        self,
        tmp_path_factory: pytest.TempPathFactory,
    ) -> Cert:
        """Fixture that provides TLS certificates in a temporary directory."""
        path = tmp_path_factory.mktemp("certs_client")
        return _generate_certs(path, separate_key=True)

    @pytest.fixture
    def _tls_certs_server(
        self,
        tmp_path_factory: pytest.TempPathFactory,
    ) -> Cert:
        """Fixture that provides TLS certificates in a temporary directory."""
        path = tmp_path_factory.mktemp("certs_server")
        return _generate_certs(path, separate_key=True)

    @pytest.fixture
    def _dsns(
        self,
        _tls_certs_client: Cert,
        _tls_certs_server: Cert,
    ) -> dict[str, str]:
        """Fixture that provides DSNs with different SSL configurations."""
        return {
            "verify-full": (
                f"{BASE}"
                f"?sslmode=verify-full"
                f"&sslrootcert={_tls_certs_server.cert.resolve()}"
                f"&sslcert={_tls_certs_client.cert.resolve()}"
                f"&sslkey={_tls_certs_client.key[0].resolve()}"
            ),
            "verify-ca": (
                f"{BASE}?sslmode=verify-ca&sslrootcert={_tls_certs_server.cert.resolve()}"
            ),
            "require": f"{BASE}?sslmode=require",
            "prefer": f"{BASE}?sslmode=prefer",
            "disable": f"{BASE}?sslmode=disable",
            "allow": f"{BASE}?sslmode=allow",
            "base": f"{BASE}",
            "non-ssl": f"{BASE}?application_name=test&statement_timeout=1000",
            "sslsni": f"{BASE}?sslmode=require&sslsni=0",
        }

    @pytest.mark.parametrize("driver", ["psycopg", "asyncpg"])
    @pytest.mark.parametrize(
        "dsn_key",
        [
            "verify-full",
            "verify-ca",
            "require",
            "prefer",
            "disable",
            "allow",
            "base",
            "non-ssl",
            "sslsni",
        ],
    )
    def test_get_pg_config(
        self,
        driver: Literal["asyncpg", "psycopg"],
        dsn_key: str,
        _dsns: dict[str, str],
        _tls_certs_client: Cert,
        _tls_certs_server: Cert,
    ) -> None:
        dsn = _dsns[dsn_key]
        base_url, connect_args = get_pg_config(make_url(dsn), driver=driver)

        # Verify base URL preserves non-SSL parameters
        expected_url = BASE.set(
            drivername=f"postgresql+{driver}",
            query={"application_name": "test", "statement_timeout": "1000"}
            if dsn_key == "non-ssl"
            else {},
        )

        assert base_url.drivername == expected_url.drivername
        assert base_url.username == expected_url.username
        assert base_url.host == expected_url.host
        assert base_url.port == expected_url.port
        assert base_url.database == expected_url.database
        assert dict(base_url.query) == dict(expected_url.query)

        # Verify SSL configuration
        if driver == "psycopg":
            expected = {}
            if dsn_key in ["verify-full", "verify-ca", "require", "prefer", "disable", "allow"]:
                expected["sslmode"] = dsn_key
            if dsn_key in ["verify-full", "verify-ca"]:
                expected["sslrootcert"] = str(_tls_certs_server.cert.resolve())
            if dsn_key == "verify-full":
                expected["sslcert"] = str(_tls_certs_client.cert.resolve())
                expected["sslkey"] = str(_tls_certs_client.key[0].resolve())
            if dsn_key == "sslsni":
                expected["sslmode"] = "require"
                expected["sslsni"] = "0"
            assert connect_args == expected
        else:  # asyncpg
            if dsn_key in ["verify-full", "verify-ca"]:
                assert isinstance(connect_args["ssl"], ssl.SSLContext)
                ssl_context = connect_args["ssl"]
                assert ssl_context.verify_mode == ssl.CERT_REQUIRED
                assert ssl_context.check_hostname == (dsn_key == "verify-full")
            elif dsn_key in ["require", "prefer", "allow", "sslsni"]:
                assert isinstance(connect_args["ssl"], ssl.SSLContext)
                ssl_context = connect_args["ssl"]
                assert ssl_context.verify_mode == ssl.CERT_NONE
                assert ssl_context.check_hostname is False
            elif dsn_key in ["disable", "base", "non-ssl"]:
                assert connect_args == {}
