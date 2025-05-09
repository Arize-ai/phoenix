from __future__ import annotations

from random import random
from secrets import token_hex

import pandas as pd
import pytest
from phoenix.client.__generated__ import v1
from typing_extensions import TypeAlias

from .._helpers import (
    _ADMIN,
    _MEMBER,
    _await_or_return,
    _GetUser,
    _RoleOrUser,
)

# Type aliases for better readability
SpanId: TypeAlias = str
SpanGlobalId: TypeAlias = str


class TestClientForSpanAnnotationsRetrieval:
    @pytest.mark.parametrize("is_async", [True, False])
    @pytest.mark.parametrize("role_or_user", [_MEMBER, _ADMIN])
    async def test_get_span_annotations_dataframe_and_list(
        self,
        is_async: bool,
        role_or_user: _RoleOrUser,
        _span_ids: tuple[tuple[SpanId, SpanGlobalId], tuple[SpanId, SpanGlobalId]],
        _get_user: _GetUser,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        (span_id1, _), (span_id2, _) = _span_ids

        user = _get_user(role_or_user).log_in()
        monkeypatch.setenv("PHOENIX_API_KEY", user.create_api_key())

        from phoenix.client import AsyncClient
        from phoenix.client import Client as SyncClient

        Client = AsyncClient if is_async else SyncClient  # type: ignore[unused-ignore]

        annotation_name_1 = f"test_anno_{token_hex(4)}"
        annotation_name_2 = f"test_anno_{token_hex(4)}"

        score1 = random()
        score2 = random()
        label1 = token_hex(4)
        label2 = token_hex(4)
        explanation1 = token_hex(8)
        explanation2 = token_hex(8)

        await _await_or_return(
            Client().annotations.add_span_annotation(
                annotation_name=annotation_name_1,
                span_id=span_id1,
                annotator_kind="LLM",
                label=label1,
                score=score1,
                explanation=explanation1,
                sync=True,
            )
        )

        await _await_or_return(
            Client().annotations.add_span_annotation(
                annotation_name=annotation_name_2,
                span_id=span_id2,
                annotator_kind="CODE",
                label=label2,
                score=score2,
                explanation=explanation2,
                sync=True,
            )
        )

        df = await _await_or_return(
            Client().spans.get_span_annotations_dataframe(
                span_ids=[span_id1, span_id2],
                project_identifier="default",
            )
        )

        assert isinstance(df, pd.DataFrame)
        assert {
            span_id1,
            span_id2,
        }.issubset(set(df.index.astype(str))), "Expected span IDs missing from dataframe"  # type: ignore[unused-ignore]

        annotations = await _await_or_return(
            Client().spans.get_span_annotations(
                span_ids=[span_id1, span_id1, span_id2],  # include duplicate on purpose
                project_identifier="default",
            )
        )

        assert isinstance(annotations, list)
        assert all(isinstance(a, dict) for a in annotations)

        by_key: dict[tuple[str, str], v1.SpanAnnotation] = {
            (a["span_id"], a["name"]): a for a in annotations
        }

        key1, key2 = (span_id1, annotation_name_1), (span_id2, annotation_name_2)
        assert key1 in by_key, "Annotation for span 1 missing from list response"
        assert key2 in by_key, "Annotation for span 2 missing from list response"

        anno1, anno2 = by_key[key1], by_key[key2]
        for anno, expected_label, expected_score, expected_explanation in (
            (anno1, label1, score1, explanation1),
            (anno2, label2, score2, explanation2),
        ):
            assert "result" in anno, "Expected 'result' key in span annotation response"
            res = anno["result"]
            assert isinstance(res, dict)
            assert res.get("label") == expected_label
            assert abs(float(res.get("score", 0.0)) - expected_score) < 1e-6
            assert res.get("explanation") == expected_explanation

        spans_input_df = pd.DataFrame({"context.span_id": [span_id1, span_id2]})
        df_from_df = await _await_or_return(
            Client().spans.get_span_annotations_dataframe(
                spans_dataframe=spans_input_df,
                project_identifier="default",
            )
        )

        assert isinstance(df_from_df, pd.DataFrame)
        for sid, aname, label, scr, expl in (
            (span_id1, annotation_name_1, label1, score1, explanation1),
            (span_id2, annotation_name_2, label2, score2, explanation2),
        ):
            subset = df_from_df[df_from_df.index.astype(str) == sid]  # type: ignore[unused-ignore]
            subset = subset[subset["annotation_name"] == aname]  # type: ignore[unused-ignore]
            assert not subset.empty  # type: ignore[unused-ignore]
            row = subset.iloc[0]  # type: ignore[unused-ignore]
            assert "result.label" in row
            assert row["result.label"] == label
            assert abs(float(row["result.score"]) - scr) < 1e-6  # type: ignore[unused-ignore]
            assert row["result.explanation"] == expl

    def test_invalid_arguments_validation(self) -> None:
        """Supplying both or neither of span_ids / spans_dataframe should error."""
        from phoenix.client import Client

        spans_client = Client().spans

        with pytest.raises(ValueError):
            spans_client.get_span_annotations_dataframe(project_identifier="default")

        dummy_df = pd.DataFrame()

        with pytest.raises(ValueError):
            spans_client.get_span_annotations_dataframe(
                spans_dataframe=dummy_df,
                span_ids=["abc"],
                project_identifier="default",
            )
