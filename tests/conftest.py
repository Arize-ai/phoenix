from _pytest.config.argparsing import Parser


def pytest_addoption(parser: Parser) -> None:
    parser.addoption(
        "--sqlite-on-disk",
        action="store_true",
        help="Run tests using file-based SQLite",
    )
    parser.addoption(
        "--run-postgres",
        action="store_true",
        help="Run tests that require Postgres",
    )
    parser.addoption(
        "--allow-flaky",
        action="store_true",
        help="Allows a number of flaky database tests to fail",
    )
