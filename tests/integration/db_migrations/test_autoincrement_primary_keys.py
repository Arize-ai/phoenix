from secrets import token_hex

from alembic.config import Config
from phoenix.db import models
from phoenix.db.types.identifier import Identifier
from phoenix.server.api.helpers.prompts.models import PromptChatTemplateV1
from sqlalchemy import Engine, select
from sqlalchemy.orm import sessionmaker

from . import _up


def test_prompt_versions(
    _engine: Engine,
    _alembic_config: Config,
) -> None:
    _up(_engine, _alembic_config, "bc8fea3c2bc8")
    db = sessionmaker(bind=_engine, expire_on_commit=False)
    with db.begin() as session:
        name = Identifier.model_validate(token_hex(16))
        prompt = models.Prompt(name=name)
        session.add(prompt)
    values = dict(
        prompt_id=prompt.id,
        template=PromptChatTemplateV1(messages=[]),
        template_type="CHAT",
        template_format="MUSTACHE",
        model_provider=token_hex(16),
        model_name=token_hex(16),
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
