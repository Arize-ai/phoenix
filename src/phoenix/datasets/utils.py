from phoenix.config import get_env_collector_endpoint, get_env_host, get_env_port


def get_base_url() -> str:
    host = get_env_host()
    if host == "0.0.0.0":
        host = "127.0.0.1"
    base_url = get_env_collector_endpoint() or f"http://{host}:{get_env_port()}"
    return base_url if base_url.endswith("/") else base_url + "/"


def get_web_base_url() -> str:
    """Return the web UI base URL.

    Returns:
        str: the web UI base URL
    """
    from phoenix.session.session import active_session

    if session := active_session():
        return session.url
    return get_base_url()


def get_experiment_url(*, dataset_id: str, experiment_id: str) -> str:
    return f"{get_web_base_url()}datasets/{dataset_id}/compare?experimentId={experiment_id}"


def get_dataset_experiments_url(*, dataset_id: str) -> str:
    return f"{get_web_base_url()}datasets/{dataset_id}/experiments"
