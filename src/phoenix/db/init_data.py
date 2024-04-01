from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from .models import Project


# Initializes the data needed to be present in the database
def init_data(engine: Engine) -> None:
    with Session(engine) as session:
        session.add_all([Project(id=0, name="default")])
        session.commit()
