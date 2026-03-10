from phoenix.server.api.mutations.sandbox_config_mutations import compute_sandbox_config_hash


class TestComputeSandboxConfigHash:
    """Tests for compute_sandbox_config_hash determinism and correctness."""

    def test_same_inputs_produce_same_hash(self) -> None:
        h1 = compute_sandbox_config_hash("E2B", 30, {"api_key_env_var": "E2B_API_KEY"})
        h2 = compute_sandbox_config_hash("E2B", 30, {"api_key_env_var": "E2B_API_KEY"})
        assert h1 == h2

    def test_different_backend_types_produce_different_hashes(self) -> None:
        h1 = compute_sandbox_config_hash("E2B", 30, {"api_key_env_var": "KEY"})
        h2 = compute_sandbox_config_hash("VERCEL", 30, {"api_key_env_var": "KEY"})
        assert h1 != h2

    def test_different_timeouts_produce_different_hashes(self) -> None:
        h1 = compute_sandbox_config_hash("E2B", 30, {})
        h2 = compute_sandbox_config_hash("E2B", 60, {})
        assert h1 != h2

    def test_different_config_values_produce_different_hashes(self) -> None:
        h1 = compute_sandbox_config_hash("E2B", 30, {"api_key_env_var": "KEY_A"})
        h2 = compute_sandbox_config_hash("E2B", 30, {"api_key_env_var": "KEY_B"})
        assert h1 != h2

    def test_key_ordering_in_config_does_not_affect_hash(self) -> None:
        h1 = compute_sandbox_config_hash("E2B", 30, {"a": "1", "b": "2"})
        h2 = compute_sandbox_config_hash("E2B", 30, {"b": "2", "a": "1"})
        assert h1 == h2

    def test_hash_is_16_hex_chars(self) -> None:
        h = compute_sandbox_config_hash("E2B", 30, {})
        assert len(h) == 16
        assert all(c in "0123456789abcdef" for c in h)

    def test_empty_config_is_valid(self) -> None:
        h = compute_sandbox_config_hash("WASM", 30, {})
        assert isinstance(h, str)
        assert len(h) == 16

    def test_repeated_calls_are_deterministic(self) -> None:
        results = {compute_sandbox_config_hash("E2B", 30, {"key": "val"}) for _ in range(10)}
        assert len(results) == 1
