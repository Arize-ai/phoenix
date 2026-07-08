import httpx
import pytest

from phoenix.client.resources.experiments import Experiments


@pytest.mark.parametrize(
    "base_url, dataset_id, experiment_id, expected_experiment_url",
    [
        (
            "http://localhost:6006",
            "12345",
            "78910",
            "http://localhost:6006/datasets/12345/compare?experimentId=78910",
        ),
        (
            "https://app.phoenix.arize.com/s/me",
            "12345",
            "78910",
            "https://app.phoenix.arize.com/s/me/datasets/12345/compare?experimentId=78910",
        ),
    ],
)
def test_get_experiment_url(
    base_url: str, dataset_id: str, experiment_id: str, expected_experiment_url: str
) -> None:
    experiments = Experiments(client=httpx.Client(base_url=base_url))
    assert experiments.get_experiment_url(dataset_id, experiment_id) == expected_experiment_url
