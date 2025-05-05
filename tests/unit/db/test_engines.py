import ssl
from typing import Literal, Union

import pytest
from smtpdfix.certs import Cert, _generate_certs
from sqlalchemy import make_url

from phoenix.db.engines import (
    _SSL_KEYS,
    _get_psycopg_connect_args,
    _get_sqlalchemy_config,
    _get_ssl_params,
    _RawSSLParams,
    _remove_asyncpg_params,
    _split_ssl_params,
    get_async_db_url,
)

# Base URL for all PostgreSQL connections
BASE = "postgresql://postgres:phoenix@localhost:5432/postgres"


def test_get_async_sqlite_db_url() -> None:
    connection_str = "sqlite:///phoenix.db"
    url = get_async_db_url(connection_str)
    assert url.drivername == "sqlite+aiosqlite"
    assert url.database == "phoenix.db"


def test_get_async_postgresql_db_url() -> None:
    # Test credentials as url params
    connection_str = "postgresql://user:password@localhost:5432/phoenix?ssl=require"
    url = get_async_db_url(connection_str)
    assert url.drivername == "postgresql+asyncpg"
    assert url.database == "phoenix"
    assert url.host == "localhost"
    assert url.query["user"] == "user"
    assert url.query["password"] == "password"
    assert url.query["ssl"] == "require"

    # Test credentials as part of the url
    connection_str = "postgresql://user:password@localhost:5432/phoenix"
    url = get_async_db_url(connection_str)
    assert url.drivername == "postgresql+asyncpg"
    assert url.database == "phoenix"
    assert url.host == "localhost"
    # NB(mikeldking): No idea why this fails to authenticate
    assert url.query["user"] == "user"
    assert url.query["password"] == "password"


class TestSQLAlchemyConfig:
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
        """Fixture that provides DSNs in different formats."""
        return {
            # psycopg format
            "psycopg_full": (
                f"{BASE}"
                f"?sslmode=verify-full"
                f"&sslrootcert={_tls_certs_server.cert.resolve()}"
                f"&sslcert={_tls_certs_client.cert.resolve()}"
                f"&sslkey={_tls_certs_client.key[0].resolve()}"
            ),
            "psycopg_ca_only": (
                f"{BASE}?sslmode=verify-ca&sslrootcert={_tls_certs_server.cert.resolve()}"
            ),
            "psycopg_require": f"{BASE}?sslmode=require",
            "psycopg_prefer": f"{BASE}?sslmode=prefer",
            "psycopg_disable": f"{BASE}?sslmode=disable",
            "psycopg_allow": f"{BASE}?sslmode=allow",
            # asyncpg format
            "asyncpg_full": (
                f"{BASE}"
                f"?sslmode=verify-full"
                f"&ssl_ca_certs_file={_tls_certs_server.cert.resolve()}"
                f"&ssl_cert_file={_tls_certs_client.cert.resolve()}"
                f"&ssl_key_file={_tls_certs_client.key[0].resolve()}"
            ),
            "asyncpg_ca_only": (
                f"{BASE}"
                f"?sslmode=verify-ca"
                f"&ssl_ca_certs_file={_tls_certs_server.cert.resolve()}"
            ),
            "asyncpg_require": f"{BASE}?sslmode=require",
            "asyncpg_prefer": f"{BASE}?sslmode=prefer",
            "asyncpg_disable": f"{BASE}?sslmode=disable",
            "asyncpg_allow": f"{BASE}?sslmode=allow",
        }

    @pytest.mark.parametrize(
        "query,expected",
        [
            pytest.param(
                {},
                ({}, {}),
                id="empty_query",
            ),
            pytest.param(
                {"sslmode": "require", "sslrootcert": "ca.crt"},
                ({}, {"sslmode": "require", "sslrootcert": "ca.crt"}),
                id="only_ssl_params",
            ),
            pytest.param(
                {"application_name": "myapp", "sslmode": "require"},
                ({"application_name": "myapp"}, {"sslmode": "require"}),
                id="mixed_params",
            ),
        ],
    )
    def test_split_ssl_params(
        self, query: dict[str, str], expected: tuple[dict[str, str], dict[str, str]]
    ) -> None:
        assert _split_ssl_params(query) == expected

    @pytest.mark.parametrize(
        "query_params,expected",
        [
            pytest.param(
                {},
                {},
                id="empty_params",
            ),
            pytest.param(
                {"sslrootcert": "ca.crt"},
                {"sslrootcert": "ca.crt"},
                id="single_ssl_param",
            ),
            pytest.param(
                {
                    "sslrootcert": "ca.crt",
                    "ssl_ca_certs_file": "ca2.crt",
                },
                ValueError,
                id="mixed_ssl_formats",
            ),
        ],
    )
    def test_get_ssl_params(
        self,
        query_params: dict[str, str],
        expected: Union[dict[str, str], type[ValueError]],
    ) -> None:
        if isinstance(expected, dict):
            assert _get_ssl_params(query_params) == expected
        else:
            with pytest.raises(expected):
                _get_ssl_params(query_params)

    @pytest.mark.parametrize(
        "raw_ssl_params,expected",
        [
            pytest.param(
                {},
                {},
                id="default_ssl_mode",
            ),
            pytest.param(
                {"sslmode": "require"},
                {"sslmode": "require"},
                id="explicit_ssl_mode",
            ),
            pytest.param(
                {
                    "sslrootcert": "ca.crt",
                    "sslcert": "client.crt",
                    "sslkey": "client.key",
                },
                {
                    "sslrootcert": "ca.crt",
                    "sslcert": "client.crt",
                    "sslkey": "client.key",
                },
                id="full_ssl_config",
            ),
        ],
    )
    def test_get_psycopg_connect_args(
        self,
        raw_ssl_params: _RawSSLParams,
        expected: dict[str, str],
    ) -> None:
        assert _get_psycopg_connect_args(raw_ssl_params) == expected

    @pytest.mark.parametrize(
        "query,expected",
        [
            pytest.param(
                {},
                {},
                id="empty_query",
            ),
            pytest.param(
                {"prepared_statement_cache_size": "1000"},
                {},
                id="remove_asyncpg_param",
            ),
            pytest.param(
                {"application_name": "myapp"},
                {"application_name": "myapp"},
                id="keep_non_asyncpg_param",
            ),
        ],
    )
    def test_remove_asyncpg_params(self, query: dict[str, str], expected: dict[str, str]) -> None:
        assert _remove_asyncpg_params(query) == expected

    @pytest.mark.parametrize(
        "driver,dsn_key",
        [
            ("psycopg", "psycopg_full"),
            ("psycopg", "psycopg_ca_only"),
            ("psycopg", "psycopg_require"),
            ("psycopg", "psycopg_prefer"),
            ("psycopg", "psycopg_disable"),
            ("psycopg", "psycopg_allow"),
            ("asyncpg", "asyncpg_full"),
            ("asyncpg", "asyncpg_ca_only"),
            ("asyncpg", "asyncpg_require"),
            ("asyncpg", "asyncpg_prefer"),
            ("asyncpg", "asyncpg_disable"),
            ("asyncpg", "asyncpg_allow"),
        ],
    )
    def test_get_sqlalchemy_config(
        self,
        driver: Literal["asyncpg", "psycopg"],
        dsn_key: str,
        _dsns: dict[str, str],
        _tls_certs_client: Cert,
        _tls_certs_server: Cert,
    ) -> None:
        # Add non-SSL parameters to the DSN
        dsn = _dsns[dsn_key] + "&application_name=test&statement_timeout=1000"
        base_url, connect_args = _get_sqlalchemy_config(make_url(dsn), driver=driver)

        # Verify base URL
        assert base_url.drivername == f"postgresql+{driver}"
        assert base_url.username == "postgres"
        assert base_url.password == "phoenix"
        assert base_url.host == "localhost"
        assert base_url.port == 5432
        assert base_url.database == "postgres"

        # Verify non-SSL parameters are preserved
        assert base_url.query["application_name"] == "test"
        assert base_url.query["statement_timeout"] == "1000"

        # Verify connect args based on driver
        if driver == "psycopg":
            expected = {}
            # Only set sslmode if explicitly provided
            if (
                "full" in dsn_key
                or "ca_only" in dsn_key
                or "require" in dsn_key
                or "prefer" in dsn_key
                or "disable" in dsn_key
                or "allow" in dsn_key
            ):
                expected["sslmode"] = (
                    f"verify-{dsn_key.split('_')[1]}"
                    if dsn_key.split("_")[1] in ["full", "ca"]
                    else dsn_key.split("_")[1]
                )
            # Add certificates if provided
            if "full" in dsn_key or "ca_only" in dsn_key:
                expected["sslrootcert"] = str(_tls_certs_server.cert.resolve())
            if "full" in dsn_key:
                expected["sslcert"] = str(_tls_certs_client.cert.resolve())
                expected["sslkey"] = str(_tls_certs_client.key[0].resolve())
            assert connect_args == expected
        else:  # asyncpg
            assert isinstance(connect_args["ssl"], ssl.SSLContext)
            ssl_context = connect_args["ssl"]

            # Verify SSL context configuration based on mode
            if "full" in dsn_key:
                # For verify-full mode
                assert ssl_context.verify_mode == ssl.CERT_REQUIRED
                assert ssl_context.check_hostname is True
                # Verify that CA certs are loaded
                assert ssl_context.get_ca_certs()
            elif "ca_only" in dsn_key:
                # For verify-ca mode
                assert ssl_context.verify_mode == ssl.CERT_REQUIRED
                assert ssl_context.check_hostname is False
                # Verify that CA certs are loaded
                assert ssl_context.get_ca_certs()
            elif "require" in dsn_key:
                # For require mode
                assert ssl_context.verify_mode == ssl.CERT_NONE
                assert ssl_context.check_hostname is False
                # System CA certs are still loaded by default
                assert ssl_context.get_ca_certs()
            else:  # prefer, allow, disable
                # For non-verify modes
                assert ssl_context.verify_mode == ssl.CERT_NONE
                assert ssl_context.check_hostname is False
                # System CA certs are still loaded by default
                assert ssl_context.get_ca_certs()

    @pytest.mark.parametrize(
        "driver,dsn_key",
        [
            ("psycopg", "asyncpg_full"),  # Test psycopg with asyncpg format
            ("asyncpg", "psycopg_full"),  # Test asyncpg with psycopg format
            ("psycopg", "asyncpg_require"),  # Test psycopg with asyncpg format (no verify)
            ("asyncpg", "psycopg_require"),  # Test asyncpg with psycopg format (no verify)
        ],
    )
    def test_get_sqlalchemy_config_mixed_formats(
        self,
        driver: Literal["asyncpg", "psycopg"],
        dsn_key: str,
        _dsns: dict[str, str],
        _tls_certs_client: Cert,
        _tls_certs_server: Cert,
    ) -> None:
        """Test that mixed format parameters are handled correctly."""
        # Add non-SSL parameters to the DSN
        dsn = _dsns[dsn_key] + "&application_name=test&statement_timeout=1000"
        base_url, connect_args = _get_sqlalchemy_config(make_url(dsn), driver=driver)

        # Verify base URL
        assert base_url.drivername == f"postgresql+{driver}"
        assert base_url.username == "postgres"
        assert base_url.password == "phoenix"
        assert base_url.host == "localhost"
        assert base_url.port == 5432
        assert base_url.database == "postgres"

        # Verify non-SSL parameters are preserved
        assert base_url.query["application_name"] == "test"
        assert base_url.query["statement_timeout"] == "1000"

        # Verify connect args based on driver
        if driver == "psycopg":
            expected = {}
            # Only set sslmode if explicitly provided
            if "full" in dsn_key or "require" in dsn_key:
                expected["sslmode"] = "verify-full" if "full" in dsn_key else "require"
            # Add certificates if provided
            if "full" in dsn_key:
                expected["sslrootcert"] = str(_tls_certs_server.cert.resolve())
                expected["sslcert"] = str(_tls_certs_client.cert.resolve())
                expected["sslkey"] = str(_tls_certs_client.key[0].resolve())
            assert connect_args == expected
        else:  # asyncpg
            assert isinstance(connect_args["ssl"], ssl.SSLContext)
            ssl_context = connect_args["ssl"]

            # Verify SSL context configuration based on mode
            if "full" in dsn_key:
                # For verify-full mode
                assert ssl_context.verify_mode == ssl.CERT_REQUIRED
                assert ssl_context.check_hostname is True
                # Verify that CA certs are loaded
                assert ssl_context.get_ca_certs()
            else:  # require mode
                # For require mode
                assert ssl_context.verify_mode == ssl.CERT_NONE
                assert ssl_context.check_hostname is False
                # System CA certs are still loaded by default
                assert ssl_context.get_ca_certs()

    def test_get_sqlalchemy_config_non_ssl_params(self) -> None:
        """Test that non-SSL parameters are passed through unchanged."""
        # Test with various non-SSL parameters
        non_ssl_params = {
            "application_name": "test",
            "statement_timeout": "1000",
            "connect_timeout": "10",
            "keepalives": "1",
            "keepalives_idle": "30",
            "keepalives_interval": "10",
            "keepalives_count": "5",
        }

        # Test with both drivers
        drivers: list[Literal["psycopg", "asyncpg"]] = ["psycopg", "asyncpg"]
        for driver in drivers:
            # Create DSN with non-SSL parameters
            query = "&".join(f"{k}={v}" for k, v in non_ssl_params.items())
            dsn = f"{BASE}?{query}"
            base_url, connect_args = _get_sqlalchemy_config(make_url(dsn), driver=driver)

            # Verify all non-SSL parameters are preserved
            for key, value in non_ssl_params.items():
                assert base_url.query[key] == value

            # Verify no SSL parameters are present
            for key in _SSL_KEYS:
                assert key not in base_url.query

            # Verify connect args
            assert connect_args == {}  # No SSL parameters should be set
