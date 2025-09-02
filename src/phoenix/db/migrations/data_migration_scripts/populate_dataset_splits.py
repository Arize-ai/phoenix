# /// script
# dependencies = [
#   "arize-phoenix[pg]",
# ]
# ///
"""
Populate the `dataset_splits` table with default splits and assign existing examples.

This script creates default dataset splits ("train", "dev", "test") and assigns
all existing dataset examples to a default split based on their creation order.

Environment variables:

- `PHOENIX_SQL_DATABASE_URL` must be set to the database connection string.
- (optional) Postgresql schema can be set via `PHOENIX_SQL_DATABASE_SCHEMA`.
"""

import os
from datetime import datetime
from time import perf_counter
from typing import Any, Union

import sqlean
from sqlalchemy import (
    JSON,
    Engine,
    NullPool,
    create_engine,
    event,
    func,
    insert,
    make_url,
    select,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from phoenix.config import ENV_PHOENIX_SQL_DATABASE_SCHEMA, get_env_database_connection_str
from phoenix.db.engines import set_postgresql_search_path


class JSONB(JSON):
    # See https://docs.sqlalchemy.org/en/20/core/custom_types.html
    __visit_name__ = "JSONB"


@compiles(JSONB, "sqlite")
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


class Base(DeclarativeBase): ...


class DatasetSplit(Base):
    __tablename__ = "dataset_splits"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    description: Mapped[Union[str, None]]
    metadata: Mapped[dict[str, Any]] = mapped_column(JSON_, nullable=False)
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]


class DatasetExample(Base):
    __tablename__ = "dataset_examples"
    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_id: Mapped[int]
    created_at: Mapped[datetime]


class DatasetSplitDatasetExample(Base):
    __tablename__ = "dataset_splits_dataset_examples"
    id: Mapped[int] = mapped_column(primary_key=True)
    dataset_split_id: Mapped[int]
    dataset_example_id: Mapped[int]


def populate_dataset_splits(engine: Engine) -> None:
    """
    Populate dataset splits with default splits and assign existing examples.
    
    Creates three default splits:
    - "train": 70% of examples (oldest)
    - "dev": 15% of examples (middle)
    - "test": 15% of examples (newest)
    """
    start_time = perf_counter()
    
    with sessionmaker(engine).begin() as session:
        # Create default splits
        default_splits = [
            {
                "name": "train",
                "description": "Training dataset split",
                "metadata": {"reserved": False, "default_ratio": 0.7},
            },
            {
                "name": "dev", 
                "description": "Development/validation dataset split",
                "metadata": {"reserved": False, "default_ratio": 0.15},
            },
            {
                "name": "test",
                "description": "Test dataset split", 
                "metadata": {"reserved": False, "default_ratio": 0.15},
            },
            {
                "name": "baseline",
                "description": "Reserved baseline split",
                "metadata": {"reserved": True},
            },
            {
                "name": "latest",
                "description": "Reserved latest split",
                "metadata": {"reserved": True},
            },
        ]
        
        # Insert default splits
        for split_data in default_splits:
            session.execute(
                insert(DatasetSplit).values(
                    name=split_data["name"],
                    description=split_data["description"],
                    metadata=split_data["metadata"],
                    created_at=func.now(),
                    updated_at=func.now(),
                )
            )
        
        # Get the created split IDs
        splits_result = session.execute(
            select(DatasetSplit.id, DatasetSplit.name).where(
                DatasetSplit.name.in_(["train", "dev", "test"])
            )
        ).all()
        
        splits_map = {name: split_id for split_id, name in splits_result}
        
        # Get all existing dataset examples ordered by creation time
        examples_result = session.execute(
            select(DatasetExample.id, DatasetExample.dataset_id)
            .order_by(DatasetExample.created_at, DatasetExample.id)
        ).all()
        
        if not examples_result:
            print("No existing dataset examples found. Skipping assignment.")
            elapsed_time = perf_counter() - start_time
            print(f"✅ Created default dataset splits in {elapsed_time:.3f} seconds.")
            return
        
        # Group examples by dataset
        datasets_examples = {}
        for example_id, dataset_id in examples_result:
            if dataset_id not in datasets_examples:
                datasets_examples[dataset_id] = []
            datasets_examples[dataset_id].append(example_id)
        
        # Assign examples to splits per dataset
        crosswalk_entries = []
        
        for dataset_id, example_ids in datasets_examples.items():
            total_examples = len(example_ids)
            
            # Calculate split boundaries
            train_end = int(total_examples * 0.7)
            dev_end = train_end + int(total_examples * 0.15)
            
            # Assign examples to splits
            for i, example_id in enumerate(example_ids):
                if i < train_end:
                    split_name = "train"
                elif i < dev_end:
                    split_name = "dev"
                else:
                    split_name = "test"
                
                crosswalk_entries.append({
                    "dataset_split_id": splits_map[split_name],
                    "dataset_example_id": example_id,
                })
        
        # Insert crosswalk entries in batches
        if crosswalk_entries:
            batch_size = 1000
            for i in range(0, len(crosswalk_entries), batch_size):
                batch = crosswalk_entries[i:i + batch_size]
                session.execute(insert(DatasetSplitDatasetExample).values(batch))
        
        print(f"Assigned {len(crosswalk_entries)} examples to splits across {len(datasets_examples)} datasets.")
    
    elapsed_time = perf_counter() - start_time
    print(f"✅ Populated dataset splits and assignments in {elapsed_time:.3f} seconds.")


if __name__ == "__main__":
    sql_database_url = make_url(get_env_database_connection_str())
    print(f"Using database URL: {sql_database_url}")
    ans = input("Is that correct? [y]/n: ")
    if ans.lower().startswith("n"):
        url = input("Please enter the correct database URL: ")
        sql_database_url = make_url(url)
    
    backend = sql_database_url.get_backend_name()
    if backend == "sqlite":
        file = sql_database_url.database
        engine = create_engine(
            url=sql_database_url.set(drivername="sqlite"),
            creator=lambda: sqlean.connect(f"file:///{file}", uri=True),
            poolclass=NullPool,
            echo=True,
        )
    elif backend == "postgresql":
        schema = os.getenv(ENV_PHOENIX_SQL_DATABASE_SCHEMA)
        if schema:
            print(f"Using schema: {schema}")
        else:
            print("No PostgreSQL schema set. (This is the default.)")
        ans = input("Is that correct? [y]/n: ")
        if ans.lower().startswith("n"):
            schema = input("Please enter the correct schema: ")
        engine = create_engine(
            url=sql_database_url.set(drivername="postgresql+psycopg"),
            poolclass=NullPool,
            echo=True,
        )
        if schema:
            event.listen(engine, "connect", set_postgresql_search_path(schema))
    else:
        raise ValueError(f"Unknown database backend: {backend}")
    
    populate_dataset_splits(engine)
