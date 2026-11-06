from _pytest.config.argparsing import Parser


def pytest_addoption(parser: Parser) -> None:
    parser.addoption(
        "--sqlite-on-disk",
        action="store_true",
        help="Run tests using file-based SQLite",
    )
    parser.addoption(
        "--db",
        default="sqlite",
        choices=["sqlite", "postgresql", "all"],
        help="Which database dialect(s) to test: sqlite (default), postgresql, or all",
    )
