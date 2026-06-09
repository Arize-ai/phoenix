from __future__ import annotations

from collections.abc import Iterable

from phoenix.server.agents.context import ResolvedContexts
from phoenix.server.agents.skills import get_skills, get_skills_for_contexts


def _names(skills: Iterable[object]) -> list[str]:
    return [getattr(skill, "name") for skill in skills]


class TestGetSkills:
    def test_base_skills_always_available(self) -> None:
        names = _names(get_skills())
        assert "debug-trace" in names
        assert "annotate-spans" in names
        assert "playground" not in names
        assert "llm-evaluator-authoring" not in names

    def test_all_bundled_skills_have_summaries(self) -> None:
        skills = get_skills(
            has_playground_context=True,
            has_dataset_context=True,
            has_llm_evaluator_context=True,
        )
        assert all(skill.summary for skill in skills)

    def test_playground_context_adds_playground_skill(self) -> None:
        names = _names(get_skills(has_playground_context=True))
        assert "playground" in names

    def test_dataset_context_adds_evaluator_authoring_skill(self) -> None:
        names = _names(get_skills(has_dataset_context=True))
        assert "llm-evaluator-authoring" in names

    def test_llm_evaluator_context_adds_evaluator_authoring_skill(self) -> None:
        names = _names(get_skills(has_llm_evaluator_context=True))
        assert "llm-evaluator-authoring" in names


class TestGetSkillsForContexts:
    def test_matches_flag_based_selection(self) -> None:
        # An empty resolved context behaves like the no-flag selection.
        assert _names(get_skills_for_contexts(ResolvedContexts())) == _names(get_skills())
