import asyncio
import json
import os
from pathlib import Path

import httpx

from phoenix.db.engines import create_engine
from phoenix.server.app import _db, create_app
from phoenix.server.types import DbSessionFactory

DATA_DIR = Path(os.environ.get("HARBOR_DATA_DIR", "/data"))
VERIFIER_LOG_DIR = Path(os.environ.get("HARBOR_VERIFIER_LOG_DIR", "/logs/verifier"))


async def get_split_example_keys(
    db_path: Path,
    dataset_name: str,
    split_name: str,
) -> set[str]:
    engine = create_engine(f"sqlite:///{db_path}", migrate=False)
    db = DbSessionFactory(db=_db(engine), dialect="sqlite")
    app = create_app(db=db, authentication_enabled=False, serve_ui=False)
    try:
        # These GET routes only require the DB state installed by create_app. Skipping
        # lifespan avoids starting unrelated gRPC and docs services in the verifier.
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport,
            base_url="http://phoenix.local",
        ) as client:
            datasets_response = await client.get(
                "/v1/datasets",
                params={"name": dataset_name},
            )
            datasets_response.raise_for_status()
            datasets = datasets_response.json()["data"]
            if len(datasets) != 1:
                return set()

            examples_response = await client.get(
                f"/v1/datasets/{datasets[0]['id']}/examples",
                params={"split": split_name},
            )
            if examples_response.status_code == 404:
                return set()
            examples_response.raise_for_status()
            examples = examples_response.json()["data"]["examples"]
            return {
                key
                for example in examples
                if isinstance(key := example["metadata"].get("example_key"), str)
            }
    finally:
        await engine.dispose()


truth = json.loads(DATA_DIR.joinpath("ground_truth.json").read_text())["step4"]
actual = asyncio.run(
    get_split_example_keys(DATA_DIR / "phoenix.db", "qa-bot-golden", truth["split_name"])
)
passed = actual == set(truth["expected_example_keys"])
VERIFIER_LOG_DIR.joinpath("reward.json").write_text(json.dumps({"reward": float(passed)}))
