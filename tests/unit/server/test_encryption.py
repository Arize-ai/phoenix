"""Tests for encryption utilities."""

import base64

import pytest
from starlette.datastructures import Secret

from phoenix.server.encryption import EncryptionService, is_encrypted


class TestEncryptionService:
    """Tests for EncryptionService class."""

    def test_encrypt_decrypt_roundtrip(self) -> None:
        """Test encryption and decryption round trip."""
        service = EncryptionService(secret=Secret("test-secret-12345"))

        data = b"sensitive-api-key-12345"
        ciphertext = service.encrypt(data)

        assert isinstance(ciphertext, bytes)
        assert ciphertext != data  # Encrypted data is different

        decrypted = service.decrypt(ciphertext)
        assert decrypted == data

    def test_encrypt_empty_bytes_raises(self) -> None:
        """Test that encrypting empty bytes raises error."""
        service = EncryptionService(secret=Secret("test-secret"))

        with pytest.raises(ValueError, match="Cannot encrypt empty bytes"):
            service.encrypt(b"")

    def test_decrypt_empty_bytes_raises(self) -> None:
        """Test that decrypting empty bytes raises error."""
        service = EncryptionService(secret=Secret("test-secret"))

        with pytest.raises(ValueError, match="Cannot decrypt empty bytes"):
            service.decrypt(b"")

    def test_decrypt_with_wrong_secret_raises(self) -> None:
        """Test that decrypting with wrong secret raises error."""
        service1 = EncryptionService(secret=Secret("secret-one"))
        service2 = EncryptionService(secret=Secret("secret-two"))

        data = b"secret"
        ciphertext = service1.encrypt(data)

        with pytest.raises(ValueError, match="Decryption failed"):
            service2.decrypt(ciphertext)

    def test_decrypt_corrupted_data_raises(self) -> None:
        """Test that decrypting corrupted data raises error."""
        service = EncryptionService(secret=Secret("test-secret"))

        with pytest.raises(ValueError, match="Decryption failed"):
            service.decrypt(b"corrupted-data")

    def test_encrypt_unicode_characters(self) -> None:
        """Test encryption handles unicode characters."""
        service = EncryptionService(secret=Secret("test-secret"))

        data = "Hello 世界 🔐 émojis".encode("utf-8")
        ciphertext = service.encrypt(data)
        decrypted = service.decrypt(ciphertext)

        assert decrypted == data

    def test_encrypt_long_data(self) -> None:
        """Test encryption handles long data."""
        service = EncryptionService(secret=Secret("test-secret"))

        data = b"a" * 10000
        ciphertext = service.encrypt(data)
        decrypted = service.decrypt(ciphertext)

        assert decrypted == data

    def test_key_derivation_is_deterministic(self) -> None:
        """Test that the same secret always produces the same encryption key."""
        secret = Secret("test-secret-12345")

        service1 = EncryptionService(secret=secret)
        service2 = EncryptionService(secret=secret)

        data = b"test"
        ciphertext1 = service1.encrypt(data)
        ciphertext2 = service2.encrypt(data)

        # Both services should be able to decrypt each other's ciphertexts
        assert service1.decrypt(ciphertext2) == data
        assert service2.decrypt(ciphertext1) == data

    def test_encrypting_same_data_twice_produces_different_ciphertexts(self) -> None:
        """Test that encrypting the same data twice produces different ciphertexts."""
        service = EncryptionService(secret=Secret("test-secret"))

        data = b"sensitive-api-key-12345"
        ciphertext1 = service.encrypt(data)
        ciphertext2 = service.encrypt(data)

        # Ciphertexts should be different (due to random IV in Fernet)
        assert ciphertext1 != ciphertext2

        # But both should decrypt to the same data
        assert service.decrypt(ciphertext1) == data
        assert service.decrypt(ciphertext2) == data

    def test_encrypt_very_short_data(self) -> None:
        """Test encryption handles very short data (1 byte)."""
        service = EncryptionService(secret=Secret("test-secret"))
        data = b"a"
        ciphertext = service.encrypt(data)
        assert service.decrypt(ciphertext) == data


class TestIsEncrypted:
    """Tests for is_encrypted function."""

    def test_returns_true_for_valid_fernet_token(self) -> None:
        """Test that is_encrypted returns True for valid Fernet tokens."""
        service = EncryptionService(secret=Secret("test-secret"))
        ciphertext = service.encrypt(b"sensitive-data")

        assert is_encrypted(ciphertext) is True

    def test_returns_false_for_empty_bytes(self) -> None:
        """Test that is_encrypted returns False for empty bytes."""
        assert is_encrypted(b"") is False

    @pytest.mark.parametrize(
        "blob",
        [
            b"not-valid-base64!!!",  # Invalid base64 characters
            b"invalid\x00bytes",  # Binary data with null bytes
        ],
    )
    def test_returns_false_for_non_base64(self, blob: bytes) -> None:
        """Test that is_encrypted returns False for non-base64 data."""
        assert is_encrypted(blob) is False

    def test_returns_false_for_too_short_base64(self) -> None:
        """Test that is_encrypted returns False for base64 that's too short."""
        # Valid base64 that decodes to less than 57 bytes (minimum Fernet token size)
        short_base64 = base64.urlsafe_b64encode(b"short")
        assert is_encrypted(short_base64) is False

    def test_returns_false_for_exactly_56_bytes(self) -> None:
        """Test boundary case: base64 that decodes to exactly 56 bytes (one byte short)."""
        # Create base64 that decodes to exactly 56 bytes
        data_56_bytes = b"\x80" + b"\x00" * 55  # Correct version byte but too short
        base64_56 = base64.urlsafe_b64encode(data_56_bytes)
        assert is_encrypted(base64_56) is False

    def test_returns_true_for_exactly_57_bytes_with_correct_version(self) -> None:
        """Test boundary case: base64 that decodes to exactly 57 bytes (minimum valid size)."""
        # Create base64 that decodes to exactly 57 bytes with correct version byte
        data_57_bytes = b"\x80" + b"\x00" * 56  # Correct version byte, minimum valid size
        base64_57 = base64.urlsafe_b64encode(data_57_bytes)
        assert is_encrypted(base64_57) is True

    def test_returns_false_for_wrong_version_byte(self) -> None:
        """Test that is_encrypted returns False for base64 with wrong version byte."""
        # Base64 data that's long enough but has wrong version byte (0x00 instead of 0x80)
        fake_token = b"\x00" + b"\x00" * 56
        fake_base64 = base64.urlsafe_b64encode(fake_token)
        assert is_encrypted(fake_base64) is False

    def test_handles_very_long_fernet_tokens(self) -> None:
        """Test that is_encrypted works with very long Fernet tokens."""
        service = EncryptionService(secret=Secret("test-secret"))
        # Very long data
        long_data = b"x" * 100000
        ciphertext = service.encrypt(long_data)
        assert is_encrypted(ciphertext) is True
