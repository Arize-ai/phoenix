"""Phoenix tokens are encoded and decoded only in JwtStore."""

import re
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[3]
_JWT_STORE = Path("src/phoenix/server/jwt_store.py")
# Any joserfc reference except its exception types, so jwt, jws, jwk and
# `import joserfc as ...` aliases are all caught.
_JOSERFC = re.compile(r"\bjoserfc\b(?!\.errors\b)")


def test_phoenix_tokens_are_encoded_and_decoded_only_in_jwt_store() -> None:
    found = {
        path.relative_to(_ROOT): lineno
        for path in sorted((_ROOT / "src" / "phoenix").rglob("*.py"))
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1)
        if _JOSERFC.search(line)
    }
    assert _JWT_STORE in found, "scan failed to notice JwtStore's joserfc usage"
    others = [f"{path}:{lineno}" for path, lineno in found.items() if path != _JWT_STORE]
    assert not others, (
        "Phoenix tokens must be encoded and decoded through JwtStore, "
        "which applies the stored-hash check:\n" + "\n".join(others)
    )
