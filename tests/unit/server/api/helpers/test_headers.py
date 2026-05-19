from phoenix.server.api.helpers.headers import clean_headers


class TestCleanHeaders:
    def test_returns_none_for_none(self) -> None:
        assert clean_headers(None) is None

    def test_returns_none_for_empty_dict(self) -> None:
        assert clean_headers({}) is None

    def test_returns_none_for_non_mapping(self) -> None:
        assert clean_headers("not a dict") is None
        assert clean_headers(42) is None
        assert clean_headers(["a", "b"]) is None

    def test_drops_empty_string_values(self) -> None:
        assert clean_headers({"X-Foo": "", "X-Bar": "bar"}) == {"X-Bar": "bar"}

    def test_drops_whitespace_only_values(self) -> None:
        assert clean_headers({"X-Foo": "   ", "X-Bar": "\t\n", "X-Baz": "baz"}) == {"X-Baz": "baz"}

    def test_drops_non_string_values(self) -> None:
        assert clean_headers({"X-Num": 1, "X-None": None, "X-Bar": "bar"}) == {"X-Bar": "bar"}

    def test_returns_none_when_all_values_dropped(self) -> None:
        assert clean_headers({"X-Foo": "", "X-Bar": "  "}) is None

    def test_preserves_valid_entries(self) -> None:
        headers = {"X-Foo": "foo", "X-Bar": "bar"}
        assert clean_headers(headers) == {"X-Foo": "foo", "X-Bar": "bar"}

    def test_preserves_values_with_internal_whitespace(self) -> None:
        assert clean_headers({"X-Foo": "  hello world  "}) == {"X-Foo": "  hello world  "}
