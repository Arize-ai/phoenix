from __future__ import annotations

from phoenix.server.agents.skills.phoenix_graphql import PHOENIX_GRAPHQL_SKILL
from phoenix.server.agents.skills.span_coding import SPAN_CODING_SKILL


def test_span_coding_skill_owns_pxi_note_recovery_instructions() -> None:
    content = SPAN_CODING_SKILL.content

    assert "Recover PXI Span Notes" in content
    assert "spanNotes" in content
    assert 'identifier == "pxi"' in content
    assert "There is no `list_span_notes` tool" in content
    assert "CLI open-coding skill" in content
    assert "CLI axial-coding skill" in content
    assert "/home/user/workspace/.pxi/coding/" in content


def test_phoenix_graphql_skill_does_not_own_pxi_note_recovery_pattern() -> None:
    assert "Recover PXI Span Notes" not in PHOENIX_GRAPHQL_SKILL.content
