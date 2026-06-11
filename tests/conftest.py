from _pytest.config import Config
from _pytest.config.argparsing import Parser


def pytest_configure(config: Config) -> None:
    config.addinivalue_line(
        "markers",
        "mysql_compatible: marks tests that can run against the MySQL db fixture",
    )


def pytest_addoption(parser: Parser) -> None:
    parser.addoption(
        "--sqlite-on-disk",
        action="store_true",
        help="Run tests using file-based SQLite",
    )
    parser.addoption(
        "--db",
        default="sqlite",
        choices=["sqlite", "postgresql", "mysql", "all"],
        help="Which database dialect(s) to test: sqlite (default), postgresql, mysql, or all",
    )
