from uuid import UUID

from phoenix.server.api.helpers.annotations import get_note_identifier


def test_get_note_identifier_uses_prefix_and_uuidv7() -> None:
    identifier = get_note_identifier("px-trace-note")

    prefix, uuid_value = identifier.split(":", maxsplit=1)

    assert prefix == "px-trace-note"
    assert UUID(uuid_value).version == 7


def test_get_note_identifier_is_unique() -> None:
    identifiers = {get_note_identifier("px-span-note") for _ in range(32)}

    assert len(identifiers) == 32
