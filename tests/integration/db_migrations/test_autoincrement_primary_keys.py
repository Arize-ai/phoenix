from secrets import token_hex

from alembic.config import Config
from phoenix.db import models
from sqlalchemy import (
    Engine,
    select,
)
from sqlalchemy.orm import sessionmaker

from . import _up


def test_prompt_versions(
    _engine: Engine,
    _alembic_config: Config,
) -> None:
    _up(_engine, _alembic_config, "bc8fea3c2bc8")
    db = sessionmaker(bind=_engine, expire_on_commit=False)
    with db.begin() as session:
        prompt = models.Prompt(name=token_hex(16))
        session.add(prompt)
    values = dict(
        prompt_id=prompt.id,
        template={},
        template_type="chat",
        template_format="mustache",
        model_provider=token_hex(16),
        model_name=token_hex(16),
    )
    with db.begin() as session:
        prompt_version = models.PromptVersion(**values)
        session.add(prompt_version)
    assert (id_ := prompt_version.id) is not None
    with db.begin() as session:
        session.delete(prompt_version)
    with db.begin() as session:
        assert session.scalar(select(models.PromptVersion.id).filter_by(id=id_)) is None
    with db.begin() as session:
        prompt_version = models.PromptVersion(**values)
        session.add(prompt_version)
    assert prompt_version.id > id_
