import hashlib
from typing import Any

from phoenix.vendor.json_canonicalization_scheme import canonicalize


def compute_example_content_hash(
    *, input: dict[str, Any], output: dict[str, Any], metadata: dict[str, Any]
) -> str:
    data = {"input": input, "metadata": metadata, "output": output}
    canonical: bytes = canonicalize(data)  # type: ignore[no-untyped-call]
    return hashlib.sha256(canonical).hexdigest()
