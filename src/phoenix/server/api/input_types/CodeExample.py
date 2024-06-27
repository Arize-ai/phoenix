from enum import Enum

import strawberry


@strawberry.enum
class CodeExample(Enum):
    CODE_EVALUATOR_SUBCLASS = "code_snippets/code_evaluator_subclass.py"
    LLM_EVALUATOR_SUBCLASS = "code_snippets/llm_evaluator_subclass.py"
