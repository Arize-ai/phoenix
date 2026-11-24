import pytest
from plan import extract_seed
from settings import DatabaseOption, PreviewSettings, parse_settings


@pytest.mark.parametrize("baseline", ["on", "off"])
@pytest.mark.parametrize("database", ["sqlite", "postgres", "both"])
def test_parses_all_preview_selections(baseline: str, database: DatabaseOption) -> None:
    settings = parse_settings(f"- Preview baseline: {baseline}\n- Preview database: {database}")

    assert settings == PreviewSettings(include_baseline=baseline == "on", database=database)
    assert settings.revisions == (("base", "head") if baseline == "on" else ("head",))
    assert settings.engines == (("sqlite", "postgres") if database == "both" else (database,))


def test_settings_inside_examples_or_preview_seed_are_ignored() -> None:
    body = """Acceptance test

> Preview baseline: off
    Preview database: sqlite
~~~text
Preview database: postgres
~~~

## Preview seed
```python
print("Preview database: sqlite")
```
"""
    assert parse_settings(body) == PreviewSettings()
    assert extract_seed(body=body) == 'print("Preview database: sqlite")\n'


@pytest.mark.parametrize(
    "body",
    [
        "Preview baseline: disabled",
        "Preview database: mysql",
        "Preview database: sqlite\nPreview database: postgres",
    ],
)
def test_invalid_or_duplicate_settings_fail(body: str) -> None:
    with pytest.raises(ValueError, match="Preview"):
        parse_settings(body)
