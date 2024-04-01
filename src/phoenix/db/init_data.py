from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from .models import Project


# Initializes the data needed to be present in the database
def init_data(engine: Engine) -> None:
    with Session(engine) as session:
        insert_stmt = insert(Project).values(name="default")
        insert_stmt.on_conflict_do_nothing(index_elements=[Project.name])
        session.execute(insert_stmt)
        session.commit()
