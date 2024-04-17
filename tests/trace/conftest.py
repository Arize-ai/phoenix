from typing import Iterator

import pytest
from phoenix.db.models import Base
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker


@pytest.fixture(scope="session")
def session_maker() -> sessionmaker:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(engine)


@pytest.fixture()
def session(session_maker: sessionmaker) -> Iterator[Session]:
    with session_maker.begin() as session:
        yield session
