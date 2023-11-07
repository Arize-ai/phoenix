from typing import List, Optional

from phoenix.experimental.evals import PromptTemplate
from phoenix.experimental.evals.models import BaseEvalModel


class Refiner:
    def __init__(
        self,
        model: BaseEvalModel,
        initial_prompt_template: PromptTemplate,
        refine_prompt_template: PromptTemplate,
        reduce_prompt_template: Optional[PromptTemplate] = None,
    ) -> None:
        self._model = model
        self._initial_prompt_template = initial_prompt_template
        self._refine_prompt_template = refine_prompt_template
        self._reduce_prompt_template = reduce_prompt_template

    def evaluate(self, chunks: List[str]) -> str:
        if len(chunks) < 2:
            raise ValueError(
                "The refine strategy is not needed to evaluate data "
                "that fits within a single context window. "
                "Consider using llm_classify instead."
            )
        model = self._model
        initial_prompt = self._initial_prompt_template.format({"chunk": chunks[0]})
        accumulator = model(initial_prompt)
        for chunk in chunks[1:]:
            refine_prompt = self._refine_prompt_template.format(
                {"accumulator": accumulator, "chunk": chunk}
            )
            accumulator = model(refine_prompt)
        if not self._reduce_prompt_template:
            return accumulator
        reduce_prompt = self._reduce_prompt_template.format({"accumulator": accumulator})
        return model(reduce_prompt)


class MapReducer:
    def __init__(
        self,
        model: BaseEvalModel,
        map_prompt_template: PromptTemplate,
        reduce_prompt_template: PromptTemplate,
    ) -> None:
        self._model = model
        self._map_prompt_template = map_prompt_template
        self._reduce_prompt_template = reduce_prompt_template

    def evaluate(self, chunks: List[str]) -> str:
        if len(chunks) < 2:
            raise ValueError(
                "The map-reduce strategy is not needed to evaluate data "
                "that fits within a single context window. "
                "Consider using llm_classify instead."
            )
        model = self._model
        mapped_records = []
        for chunk in chunks:
            map_prompt = self._map_prompt_template.format({"chunk": chunk})
            intermediate_output = model(map_prompt)
            mapped_records.append(intermediate_output)
        reduce_prompt = self._reduce_prompt_template.format({"mapped": mapped_records})
        return model(reduce_prompt)
