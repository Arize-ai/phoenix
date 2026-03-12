from phoenix.client.utils.semver_utils import (
    format_version,
    parse_semantic_version,
    satisfies_min_version,
)


class TestParseSemanticVersion:
    def test_valid_version(self) -> None:
        assert parse_semantic_version("13.14.0") == (13, 14, 0)

    def test_whitespace(self) -> None:
        assert parse_semantic_version("  1.2.3  ") == (1, 2, 3)

    def test_extra_parts(self) -> None:
        assert parse_semantic_version("1.2.3.4") == (1, 2, 3)

    def test_fewer_than_three_parts(self) -> None:
        assert parse_semantic_version("1.2") is None

    def test_non_numeric(self) -> None:
        assert parse_semantic_version("a.b.c") is None

    def test_empty_string(self) -> None:
        assert parse_semantic_version("") is None


class TestSatisfiesMinVersion:
    def test_equal(self) -> None:
        assert satisfies_min_version((13, 14, 0), (13, 14, 0)) is True

    def test_major_greater(self) -> None:
        assert satisfies_min_version((14, 0, 0), (13, 14, 0)) is True

    def test_minor_greater(self) -> None:
        assert satisfies_min_version((13, 15, 0), (13, 14, 0)) is True

    def test_patch_greater(self) -> None:
        assert satisfies_min_version((13, 14, 1), (13, 14, 0)) is True

    def test_major_less(self) -> None:
        assert satisfies_min_version((12, 99, 99), (13, 14, 0)) is False

    def test_minor_less(self) -> None:
        assert satisfies_min_version((13, 13, 99), (13, 14, 0)) is False

    def test_patch_less(self) -> None:
        assert satisfies_min_version((13, 14, 0), (13, 14, 1)) is False


class TestFormatVersion:
    def test_format(self) -> None:
        assert format_version((13, 14, 0)) == "13.14.0"

    def test_format_zeros(self) -> None:
        assert format_version((0, 0, 0)) == "0.0.0"
