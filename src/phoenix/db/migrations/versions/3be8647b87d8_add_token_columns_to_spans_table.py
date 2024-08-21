"""add token columns to spans table

Revision ID: 3be8647b87d8
Revises: 10460e46d750
Create Date: 2024-08-03 22:11:28.733133

"""

from typing import Any, Dict, List, Optional, Sequence, TypedDict, Union

import sqlalchemy as sa
from alembic import op
from openinference.semconv.trace import SpanAttributes
from sqlalchemy import (
    JSON,
    Dialect,
    MetaData,
    TypeDecorator,
    update,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
)


class JSONB(JSON):
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    __visit_name__ = "JSONB"


@compiles(JSONB, "sqlite")  # type: ignore
def _(*args: Any, **kwargs: Any) -> str:
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    return "JSONB"


JSON_ = (
    JSON()
    .with_variant(
        postgresql.JSONB(),  # type: ignore
        "postgresql",
    )
    .with_variant(
        JSONB(),
        "sqlite",
    )
)


class JsonDict(TypeDecorator[Dict[str, Any]]):
    # See # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    cache_ok = True
    impl = JSON_

    def process_bind_param(self, value: Optional[Dict[str, Any]], _: Dialect) -> Dict[str, Any]:
        return value if isinstance(value, dict) else {}


class JsonList(TypeDecorator[List[Any]]):
    # See # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    cache_ok = True
    impl = JSON_

    def process_bind_param(self, value: Optional[List[Any]], _: Dialect) -> List[Any]:
        return value if isinstance(value, list) else []


class ExperimentRunOutput(TypedDict, total=False):
    task_output: Any


class Base(DeclarativeBase):
    # Enforce best practices for naming constraints
    # https://alembic.sqlalchemy.org/en/latest/naming.html#integration-of-naming-conventions-into-operations-autogenerate
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(table_name)s_%(column_0_N_name)s",
            "uq": "uq_%(table_name)s_%(column_0_N_name)s",
            "ck": "ck_%(table_name)s_`%(constraint_name)s`",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )
    type_annotation_map = {
        Dict[str, Any]: JsonDict,
        List[Dict[str, Any]]: JsonList,
        ExperimentRunOutput: JsonDict,
    }


class Span(Base):
    __tablename__ = "spans"
    id: Mapped[int] = mapped_column(primary_key=True)
    attributes: Mapped[Dict[str, Any]]
    llm_token_count_prompt: Mapped[Optional[int]]
    llm_token_count_completion: Mapped[Optional[int]]


# revision identifiers, used by Alembic.
revision: str = "3be8647b87d8"
down_revision: Union[str, None] = "10460e46d750"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

LLM_TOKEN_COUNT_PROMPT = SpanAttributes.LLM_TOKEN_COUNT_PROMPT.split(".")
LLM_TOKEN_COUNT_COMPLETION = SpanAttributes.LLM_TOKEN_COUNT_COMPLETION.split(".")


def upgrade() -> None:
    op.add_column("spans", sa.Column("llm_token_count_prompt", sa.Integer, nullable=True))
    op.add_column("spans", sa.Column("llm_token_count_completion", sa.Integer, nullable=True))
    op.execute(
        update(Span).values(
            llm_token_count_prompt=Span.attributes[LLM_TOKEN_COUNT_PROMPT].as_float(),
            llm_token_count_completion=Span.attributes[LLM_TOKEN_COUNT_COMPLETION].as_float(),
        )
    )


def downgrade() -> None:
    op.drop_column("spans", "llm_token_count_completion")
    op.drop_column("spans", "llm_token_count_prompt")
