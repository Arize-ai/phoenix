from hashlib import pbkdf2_hmac

NUM_ITERATIONS = 1_000_000


def compute_password_hash(password: str, salt: str) -> str:
    """
    Salts and hashes a password using PBKDF2, HMAC, and SHA256.
    """
    password_bytes = password.encode("utf-8")
    salt_bytes = salt.encode("utf-8")
    password_hash_bytes = pbkdf2_hmac("sha256", password_bytes, salt_bytes, NUM_ITERATIONS)
    password_hash = password_hash_bytes.hex()
    return password_hash
