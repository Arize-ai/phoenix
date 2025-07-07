from secrets import token_hex

from alembic.config import Config
from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.db.types.model_provider import ModelProvider
from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplate,
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
)
from sqlalchemy import Engine, select
from sqlalchemy.orm import sessionmaker

from . import _up


def test_prompt_versions(
    _engine: Engine,
    _alembic_config: Config,
    _schema: str,
) -> None:
    _up(_engine, _alembic_config, "bc8fea3c2bc8", _schema)
    db = sessionmaker(bind=_engine, expire_on_commit=False)
    with db.begin() as session:
        name = Identifier.model_validate(token_hex(16))
        prompt = models.Prompt(name=name)
        session.add(prompt)
    values = dict(
        prompt_id=prompt.id,
        template=PromptChatTemplate(type="chat", messages=[]),
        template_type="CHAT",
        template_format="MUSTACHE",
        model_provider=ModelProvider.OPENAI,
        model_name=token_hex(16),
        invocation_parameters=PromptOpenAIInvocationParameters(
            type="openai",
            openai=PromptOpenAIInvocationParametersContent(
                temperature=0.5,
            ),
        ),
    )
    with db.begin() as session:
        prompt_version = models.PromptVersion(**values)
        assert prompt_version.id is None
        session.add(prompt_version)
    assert (id_ := prompt_version.id) is not None
    with db.begin() as session:
        assert session.scalar(select(models.PromptVersion.id).filter_by(id=id_)) is not None
    with db.begin() as session:
        session.delete(prompt_version)
    with db.begin() as session:
        assert session.scalar(select(models.PromptVersion.id).filter_by(id=id_)) is None
    with db.begin() as session:
        new_prompt_version = models.PromptVersion(**values)
        assert new_prompt_version.id is None
        session.add(new_prompt_version)
    assert new_prompt_version.id > id_
