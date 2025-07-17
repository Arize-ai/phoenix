from secrets import token_hex

from phoenix.db.types.token_price_customization import (
    ThresholdBasedTokenPriceCustomization,
    TokenPriceCustomization,
    TokenPriceCustomizationParser,
)


class TestTokenPriceCustomizationParserRoundTrip:
    """Test round-trip compatibility for forward compatibility scenarios."""

    def test_round_trip_known_threshold_based_type(self) -> None:
        """Test that known threshold_based type can be round-tripped."""
        raw = {
            "type": "threshold_based",
            "key": "llm.token_count.prompt",
            "threshold": 1000.0,
            "new_rate": 0.002,
        }

        # Parse
        result = TokenPriceCustomizationParser.parse(raw)
        assert type(result) is ThresholdBasedTokenPriceCustomization

        # Verify all original data is preserved
        assert result.model_dump() == raw

    def test_round_trip_unknown_type_preserves_all_data(self) -> None:
        """Test that unknown types preserve all data during round-trip."""
        raw = {
            "type": token_hex(16),  # Random unknown type
            "some_field": "some_value",
            "another_field": 123,
            "nested_field": {"key": "value", "array": [1, 2, 3]},
            "boolean_field": True,
            "null_field": None,
        }

        # Parse unknown type
        result = TokenPriceCustomizationParser.parse(raw)
        assert type(result) is TokenPriceCustomization

        # Verify all original data is preserved
        assert result.model_dump() == raw
