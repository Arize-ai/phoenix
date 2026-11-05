import json

import httpx2
from sqlalchemy import select

from phoenix.db import models
from phoenix.server.api.routers.v1.datasets import (
    FileContentEncoding,
    _process_csv,
    _process_jsonl,
)
from phoenix.server.types import DbSessionFactory


async def test_process_csv_ignores_utf8_bom_in_header() -> None:
    examples = await _process_csv(
        content=b"\xef\xbb\xbfquestion,answer\r\nhi,there\r\n",
        content_encoding=FileContentEncoding.NONE,
        input_keys=frozenset({"question"}),
        output_keys=frozenset({"answer"}),
        metadata_keys=frozenset(),
        split_keys=frozenset(),
        span_id_key=None,
    )
    [example] = list(examples)
    assert example.input == {"question": "hi"}
    assert example.output == {"answer": "there"}


async def test_process_jsonl_ignores_utf8_bom() -> None:
    examples = await _process_jsonl(
        b'\xef\xbb\xbf{"q": "a"}\n{"q": "b"}\n',
        FileContentEncoding.NONE,
        frozenset({"q"}),
        frozenset(),
        frozenset(),
        frozenset(),
        None,
    )
    assert [e.input for e in examples] == [{"q": "a"}, {"q": "b"}]


async def test_process_jsonl_skips_blank_lines() -> None:
    examples = await _process_jsonl(
        b'{"q": "a"}\n\n{"q": "b"}\r\n\n',
        FileContentEncoding.NONE,
        frozenset({"q"}),
        frozenset(),
        frozenset(),
        frozenset(),
        None,
    )
    assert [e.input for e in examples] == [{"q": "a"}, {"q": "b"}]


async def test_process_jsonl_splits_rows_only_on_newlines() -> None:
    # json.dumps(..., ensure_ascii=False), as the JSONL export writes, leaves these unescaped.
    rows = [{"q": "a\u2028b"}, {"q": "c\x85d"}, {"q": "e\u2029f"}]
    content = "\n".join(json.dumps(row, ensure_ascii=False) for row in rows).encode()
    examples = await _process_jsonl(
        content,
        FileContentEncoding.NONE,
        frozenset({"q"}),
        frozenset(),
        frozenset(),
        frozenset(),
        None,
    )
    assert [e.input for e in examples] == rows


async def test_upload_csv_with_bom_maps_bom_prefixed_non_input_keys_to_column(
    httpx_client: httpx2.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """phoenix-client reads the CSV header without utf-8-sig, so the first column's name
    arrives with the BOM attached, here for the example id and a metadata key."""
    name = "csv_with_bom_and_bom_prefixed_keys"
    response = await httpx_client.post(
        url="v1/datasets/upload?sync=true",
        files={"file": (" ", b"\xef\xbb\xbfid,question,answer\r\nex-1,hi,there\r\n", "text/csv")},
        data={
            "action": "create",
            "name": name,
            "input_keys[]": ["question"],
            "output_keys[]": ["answer"],
            "metadata_keys[]": ["\ufeffid"],
            "example_id_key": "\ufeffid",
        },
    )
    assert response.status_code == 200, response.text
    async with db() as session:
        [(example, revision)] = (
            await session.execute(
                select(models.DatasetExample, models.DatasetExampleRevision)
                .join(models.DatasetExampleRevision)
                .join_from(models.DatasetExample, models.Dataset)
                .where(models.Dataset.name == name)
            )
        ).all()
    assert revision.input == {"question": "hi"}
    assert revision.output == {"answer": "there"}
    assert revision.metadata_ == {"id": "ex-1"}
    assert example.external_id == "ex-1"
