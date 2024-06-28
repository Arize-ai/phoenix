from phoenix.config import get_web_base_url


def get_experiment_url(*, dataset_id: str, experiment_id: str) -> str:
    return f"{get_web_base_url()}datasets/{dataset_id}/compare?experimentId={experiment_id}"


def get_dataset_experiments_url(*, dataset_id: str) -> str:
    return f"{get_web_base_url()}datasets/{dataset_id}/experiments"
