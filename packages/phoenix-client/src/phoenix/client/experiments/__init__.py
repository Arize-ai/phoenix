from typing import TYPE_CHECKING, Any, Mapping, Optional, Union

if TYPE_CHECKING:
    from phoenix.client.client import AsyncClient, Client
from phoenix.client.resources.datasets import Dataset
from phoenix.client.resources.experiments.types import (
    ExperimentEvaluators,
    ExperimentTask,
    RanExperiment,
    RateLimitErrors,
)

DEFAULT_TIMEOUT_IN_SECONDS = 60


def run_experiment(
    *,
    dataset: Dataset,
    task: ExperimentTask,
    evaluators: Optional[ExperimentEvaluators] = None,
    experiment_name: Optional[str] = None,
    experiment_description: Optional[str] = None,
    experiment_metadata: Optional[Mapping[str, Any]] = None,
    rate_limit_errors: Optional[RateLimitErrors] = None,
    dry_run: Union[bool, int] = False,
    print_summary: bool = True,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    client: Optional["Client"] = None,
) -> RanExperiment:
    """
    Run an experiment using a given dataset of examples.

    An experiment is a user-defined task that runs on each example in a dataset. The results from
    each experiment can be evaluated using any number of evaluators to measure the behavior of the
    task. The experiment and evaluation results are stored in the Phoenix database for comparison
    and analysis.

    A `task` is a synchronous function that returns a JSON serializable output. If the `task` is a
    function of one argument then that argument will be bound to the `input` field of the dataset
    example. Alternatively, the `task` can be a function of any combination of specific argument
    names that will be bound to special values:

    - `input`: The input field of the dataset example
    - `expected`: The expected or reference output of the dataset example
    - `reference`: An alias for `expected`
    - `metadata`: Metadata associated with the dataset example
    - `example`: The dataset `Example` object with all associated fields

    An `evaluator` is either a synchronous function that returns an evaluation result object,
    which can take any of the following forms:

    - an EvaluationResult dict with optional fields for score, label, explanation and metadata
    - a `bool`, which will be interpreted as a score of 0 or 1 plus a label of "True" or "False"
    - a `float`, which will be interpreted as a score
    - a `str`, which will be interpreted as a label
    - a 2-`tuple` of (`float`, `str`), which will be interpreted as (score, explanation)

    If the `evaluator` is a function of one argument then that argument will be bound to the
    `output` of the task. Alternatively, the `evaluator` can be a function of any combination
    of specific argument names that will be bound to special values:

    - `input`: The input field of the dataset example
    - `output`: The output of the task
    - `expected`: The expected or reference output of the dataset example
    - `reference`: An alias for `expected`
    - `metadata`: Metadata associated with the dataset example

    Phoenix also provides pre-built evaluators in the `phoenix.experiments.evaluators` module.

    Args:
        dataset: The dataset on which to run the experiment.
        task: The task to run on each example in the dataset.
        evaluators: A single evaluator or sequence of evaluators used to evaluate the results
            of the experiment. Defaults to None.
        experiment_name: The name of the experiment. Defaults to None.
        experiment_description: A description of the experiment. Defaults to None.
        experiment_metadata: Metadata to associate with the experiment. Defaults to None.
        rate_limit_errors: An exception or sequence of exceptions to adaptively throttle on.
            Defaults to None.
        dry_run: Run the experiment in dry-run mode. When set, experiment results will not be
            recorded in Phoenix. If True, the experiment will run on a random dataset example.
            If an integer, the experiment will run on a random sample of the dataset examples
            of the given size. Defaults to False.
        print_summary: Whether to print a summary of the experiment and evaluation results.
            Defaults to True.
        timeout: The timeout for the task execution in seconds. Use this to run longer tasks
            to avoid re-queuing the same task multiple times. Defaults to 60.
        client: A Phoenix client instance to use for the experiment. If not provided, a new client
            will be configured from environment variables. Defaults to None.

    Returns:
        A dictionary containing the experiment results.

    Raises:
        ValueError: If dataset format is invalid or has no examples.
        httpx.HTTPStatusError: If the API returns an error response.

    Example:
        Basic usage:
            >>> from phoenix.client.experiments import run_experiment
            >>> from phoenix.client import Client
            >>> client = Client()
            >>> dataset = client.datasets.get_dataset(dataset="my-dataset")
            >>>
            >>> def my_task(input):
            ...     return f"Hello {input['name']}"
            >>>
            >>> experiment = run_experiment(
            ...     dataset=dataset,
            ...     task=my_task,
            ...     experiment_name="greeting-experiment"
            ... )

        With client configuration:
            >>> experiment = run_experiment(
            ...     base_url="https://app.phoenix.arize.com",
            ...     api_key="your-api-key",
            ...     dataset=dataset,
            ...     task=my_task,
            ...     experiment_name="greeting-experiment"
            ... )

        With evaluators:
            >>> def accuracy_evaluator(output, expected):
            ...     return 1.0 if output == expected['text'] else 0.0
            >>>
            >>> experiment = run_experiment(
            ...     dataset=dataset,
            ...     task=my_task,
            ...     evaluators=[accuracy_evaluator],
            ...     experiment_name="evaluated-experiment"
            ... )

        Using dynamic binding for tasks:
            >>> def my_task(input, metadata, expected):
            ...     # Task can access multiple fields from the dataset example
            ...     context = metadata.get("context", "")
            ...     return f"Context: {context}, Input: {input}, Expected: {expected}"
            >>>
            >>> experiment = run_experiment(
            ...     dataset=dataset,
            ...     task=my_task,
            ...     experiment_name="dynamic-task"
            ... )

        Using dynamic binding for evaluators:
            >>> def my_evaluator(output, input, expected, metadata):
            ...     # Evaluator can access task output and example fields
            ...     score = calculate_similarity(output, expected)
            ...     return {"score": score, "label": "pass" if score > 0.8 else "fail"}
            >>>
            >>> experiment = run_experiment(
            ...     dataset=dataset,
            ...     task=my_task,
            ...     evaluators=[my_evaluator],
            ...     experiment_name="dynamic-evaluator"
            ... )

        Direct client usage (equivalent):
            >>> from phoenix.client import Client
            >>> client = Client()
            >>> experiment = client.experiments.run_experiment(
            ...     dataset=dataset,
            ...     task=my_task,
            ...     experiment_name="greeting-experiment"
            ... )
    """
    if client is None:
        from phoenix.client.client import Client

        client = Client()
    return client.experiments.run_experiment(
        dataset=dataset,
        task=task,
        evaluators=evaluators,
        experiment_name=experiment_name,
        experiment_description=experiment_description,
        experiment_metadata=experiment_metadata,
        rate_limit_errors=rate_limit_errors,
        dry_run=dry_run,
        print_summary=print_summary,
        timeout=timeout,
    )


async def async_run_experiment(
    *,
    dataset: Dataset,
    task: ExperimentTask,
    evaluators: Optional[ExperimentEvaluators] = None,
    experiment_name: Optional[str] = None,
    experiment_description: Optional[str] = None,
    experiment_metadata: Optional[Mapping[str, Any]] = None,
    rate_limit_errors: Optional[RateLimitErrors] = None,
    dry_run: Union[bool, int] = False,
    print_summary: bool = True,
    concurrency: int = 3,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    client: Optional["AsyncClient"] = None,
) -> RanExperiment:
    """
    Run an experiment using a given dataset of examples (async version).

    An experiment is a user-defined task that runs on each example in a dataset. The results from
    each experiment can be evaluated using any number of evaluators to measure the behavior of the
    task. The experiment and evaluation results are stored in the Phoenix database for comparison
    and analysis.

    A `task` is either a synchronous or asynchronous function that returns a JSON serializable
    output. If the `task` is a function of one argument then that argument will be bound to the
    `input` field of the dataset example. Alternatively, the `task` can be a function of any
    combination of specific argument names that will be bound to special values:

    - `input`: The input field of the dataset example
    - `expected`: The expected or reference output of the dataset example
    - `reference`: An alias for `expected`
    - `metadata`: Metadata associated with the dataset example
    - `example`: The dataset `Example` object with all associated fields

    An `evaluator` is either a synchronous or asynchronous function that returns an evaluation
    result object, which can take any of the following forms:

    - an EvaluationResult dict with optional fields for score, label, explanation and metadata
    - a `bool`, which will be interpreted as a score of 0 or 1 plus a label of "True" or "False"
    - a `float`, which will be interpreted as a score
    - a `str`, which will be interpreted as a label
    - a 2-`tuple` of (`float`, `str`), which will be interpreted as (score, explanation)

    If the `evaluator` is a function of one argument then that argument will be bound to the
    `output` of the task. Alternatively, the `evaluator` can be a function of any combination
    of specific argument names that will be bound to special values:

    - `input`: The input field of the dataset example
    - `output`: The output of the task
    - `expected`: The expected or reference output of the dataset example
    - `reference`: An alias for `expected`
    - `metadata`: Metadata associated with the dataset example

    Phoenix also provides pre-built evaluators in the `phoenix.experiments.evaluators` module.

    Args:
        base_url: The base URL for the API endpoint. If not provided, it will be read from the
            environment variables or fall back to http://localhost:6006/.
        api_key: The API key for authentication. If provided, it will be included in the
            Authorization header as a bearer token. Defaults to None.
        headers: Additional headers to be included in the HTTP requests. Defaults to None.
            This is ignored if http_client is provided. Additional headers may be added from
            the environment variables, but won't override specified values.
        http_client: An instance of httpx.AsyncClient to be used for making HTTP requests. If not
            provided, a new instance will be created. Defaults to None.
        dataset: The dataset on which to run the experiment.
        task: The task to run on each example in the dataset.
        evaluators: A single evaluator or sequence of evaluators used to evaluate the results
            of the experiment. Defaults to None.
        experiment_name: The name of the experiment. Defaults to None.
        experiment_description: A description of the experiment. Defaults to None.
        experiment_metadata: Metadata to associate with the experiment. Defaults to None.
        rate_limit_errors: An exception or sequence of exceptions to adaptively throttle on.
            Defaults to None.
        dry_run: Run the experiment in dry-run mode. When set, experiment results will not be
            recorded in Phoenix. If True, the experiment will run on a random dataset example.
            If an integer, the experiment will run on a random sample of the dataset examples
            of the given size. Defaults to False.
        print_summary: Whether to print a summary of the experiment and evaluation results.
            Defaults to True.
        concurrency: Specifies the concurrency for task execution. Defaults to 3.
        timeout: The timeout for the task execution in seconds. Use this to run longer tasks
            to avoid re-queuing the same task multiple times. Defaults to 60.

    Returns:
        A dictionary containing the experiment results.

    Raises:
        ValueError: If dataset format is invalid or has no examples.
        httpx.HTTPStatusError: If the API returns an error response.

    Example:
        Basic usage:
            >>> from phoenix.client.experiments import async_run_experiment
            >>> from phoenix.client import AsyncClient
            >>> client = AsyncClient()
            >>> dataset = await client.datasets.get_dataset(dataset="my-dataset")
            >>>
            >>> async def my_task(input):
            ...     return f"Hello {input['name']}"
            >>>
            >>> experiment = await async_run_experiment(
            ...     dataset=dataset,
            ...     task=my_task,
            ...     experiment_name="greeting-experiment"
            ... )

        With client configuration:
            >>> experiment = await async_run_experiment(
            ...     base_url="https://app.phoenix.arize.com",
            ...     api_key="your-api-key",
            ...     dataset=dataset,
            ...     task=my_task,
            ...     experiment_name="greeting-experiment"
            ... )

        With evaluators:
            >>> async def accuracy_evaluator(output, expected):
            ...     return 1.0 if output == expected['text'] else 0.0
            >>>
            >>> experiment = await async_run_experiment(
            ...     dataset=dataset,
            ...     task=my_task,
            ...     evaluators=[accuracy_evaluator],
            ...     experiment_name="evaluated-experiment"
            ... )

        Using dynamic binding for tasks:
            >>> async def my_task(input, metadata, expected):
            ...     # Task can access multiple fields from the dataset example
            ...     context = metadata.get("context", "")
            ...     return f"Context: {context}, Input: {input}, Expected: {expected}"
            >>>
            >>> experiment = await async_run_experiment(
            ...     dataset=dataset,
            ...     task=my_task,
            ...     experiment_name="dynamic-task",
            ...     concurrency=5
            ... )

        Using dynamic binding for evaluators:
            >>> async def my_evaluator(output, input, expected, metadata):
            ...     # Evaluator can access task output and example fields
            ...     score = await calculate_similarity(output, expected)
            ...     return {"score": score, "label": "pass" if score > 0.8 else "fail"}
            >>>
            >>> experiment = await async_run_experiment(
            ...     dataset=dataset,
            ...     task=my_task,
            ...     evaluators=[my_evaluator],
            ...     experiment_name="dynamic-evaluator",
            ...     concurrency=10
            ... )

        Direct client usage (equivalent):
            >>> from phoenix.client import AsyncClient
            >>> client = AsyncClient()
            >>> experiment = await client.experiments.run_experiment(
            ...     dataset=dataset,
            ...     task=my_task,
            ...     experiment_name="greeting-experiment",
            ...     concurrency=5
            ... )
    """
    if client is None:
        from phoenix.client.client import AsyncClient

        client = AsyncClient()
    return await client.experiments.run_experiment(
        dataset=dataset,
        task=task,
        evaluators=evaluators,
        experiment_name=experiment_name,
        experiment_description=experiment_description,
        experiment_metadata=experiment_metadata,
        rate_limit_errors=rate_limit_errors,
        dry_run=dry_run,
        print_summary=print_summary,
        concurrency=concurrency,
        timeout=timeout,
    )


def get_experiment(
    *,
    experiment_id: str,
    client: Optional["Client"] = None,
) -> RanExperiment:
    """
    Get a completed experiment by ID.

    This function retrieves a completed experiment with all its task runs and evaluation runs,
    returning a RanExperiment object that can be used with evaluate_experiment to run additional
    evaluations.

    Args:
        experiment_id: The ID of the experiment to retrieve.
        client: A Phoenix client instance to use for the experiment. If not provided, a new client
            will be configured from environment variables. Defaults to None.

    Returns:
        A RanExperiment object containing the experiment data, task runs, and evaluation runs.

    Raises:
        ValueError: If the experiment is not found.
        httpx.HTTPStatusError: If the API returns an error response.

    Example:
        Basic usage:
            >>> from phoenix.client.experiments import get_experiment
            >>> experiment = get_experiment(experiment_id="123")

        Using with evaluate_experiment:
            >>> from phoenix.client.experiments import get_experiment, evaluate_experiment
            >>> experiment = get_experiment(experiment_id="123")
            >>> evaluated = evaluate_experiment(
            ...     experiment=experiment,
            ...     evaluators=[correctness_evaluator],
            ...     print_summary=True,
            ... )

        Direct client usage (equivalent):
            >>> from phoenix.client import Client
            >>> client = Client()
            >>> experiment = client.experiments.get_experiment(experiment_id="123")
    """
    if client is None:
        from phoenix.client.client import Client

        client = Client()
    return client.experiments.get_experiment(experiment_id=experiment_id)


async def async_get_experiment(
    *,
    experiment_id: str,
    client: Optional["AsyncClient"] = None,
) -> RanExperiment:
    """
    Get a completed experiment by ID (async version).

    This function retrieves a completed experiment with all its task runs and evaluation runs,
    returning a RanExperiment object that can be used with async_evaluate_experiment to run
    additional evaluations.

    Args:
        experiment_id: The ID of the experiment to retrieve.
        client: A Phoenix client instance to use for the experiment. If not provided, a new client
            will be configured from environment variables. Defaults to None.

    Returns:
        A RanExperiment object containing the experiment data, task runs, and evaluation runs.

    Raises:
        ValueError: If the experiment is not found.
        httpx.HTTPStatusError: If the API returns an error response.

    Example:
        Basic usage:
            >>> from phoenix.client.experiments import async_get_experiment
            >>> experiment = await async_get_experiment(experiment_id="123")

        Using with async_evaluate_experiment:
            >>> from phoenix.client.experiments import (
            ...     async_get_experiment,
            ...     async_evaluate_experiment,
            ... )
            >>> experiment = await async_get_experiment(experiment_id="123")
            >>> evaluated = await async_evaluate_experiment(
            ...     experiment=experiment,
            ...     evaluators=[correctness_evaluator],
            ...     print_summary=True,
            ... )

        Direct client usage (equivalent):
            >>> from phoenix.client import AsyncClient
            >>> client = AsyncClient()
            >>> experiment = await client.experiments.get_experiment(experiment_id="123")
    """
    if client is None:
        from phoenix.client.client import AsyncClient

        client = AsyncClient()
    return await client.experiments.get_experiment(experiment_id=experiment_id)


def evaluate_experiment(
    *,
    experiment: RanExperiment,
    evaluators: ExperimentEvaluators,
    dry_run: bool = False,
    print_summary: bool = True,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    rate_limit_errors: Optional[RateLimitErrors] = None,
    client: Optional["Client"] = None,
) -> RanExperiment:
    """
    Run evaluators on a completed experiment.

    An evaluator is either a synchronous or asynchronous function that returns an evaluation
    result object, which can take any of the following forms:

    - an EvaluationResult dict with optional fields for score, label, explanation and metadata
    - a `bool`, which will be interpreted as a score of 0 or 1 plus a label of "True" or "False"
    - a `float`, which will be interpreted as a score
    - a `str`, which will be interpreted as a label
    - a 2-`tuple` of (`float`, `str`), which will be interpreted as (score, explanation)

    If the `evaluator` is a function of one argument then that argument will be bound to the
    `output` of the task. Alternatively, the `evaluator` can be a function of any combination
    of specific argument names that will be bound to special values:

    - `input`: The input field of the dataset example
    - `output`: The output of the task
    - `expected`: The expected or reference output of the dataset example
    - `reference`: An alias for `expected`
    - `metadata`: Metadata associated with the dataset example

    Phoenix also provides pre-built evaluators in the `phoenix.experiments.evaluators` module.

    Args:
        experiment: The experiment to evaluate, returned from `run_experiment` or `get_experiment`.
        evaluators: A single evaluator or sequence of evaluators used to evaluate the results
            of the experiment.
        dry_run: Run the evaluation in dry-run mode. When set, evaluation results will not be
            recorded in Phoenix. Defaults to False.
        print_summary: Whether to print a summary of the evaluation results. Defaults to True.
        timeout: The timeout for the evaluation execution in seconds. Defaults to 60.
        rate_limit_errors: An exception or sequence of exceptions to adaptively throttle on.
            Defaults to None.
        client: A Phoenix client instance to use for the experiment. If not provided, a new client
            will be configured from environment variables. Defaults to None.

    Returns:
        A dictionary containing the evaluation results with the same format as run_experiment.

    Raises:
        ValueError: If no evaluators are provided or experiment has no runs.
        httpx.HTTPStatusError: If the API returns an error response.

    Example:
        Basic usage:
            >>> from phoenix.client.experiments import get_experiment, evaluate_experiment
            >>> experiment = get_experiment(experiment_id="123")
            >>> def accuracy_evaluator(output, expected):
            ...     return 1.0 if output == expected else 0.0
            >>> evaluated = evaluate_experiment(
            ...     experiment=experiment,
            ...     evaluators=[accuracy_evaluator]
            ... )

        Using dynamic binding for evaluators:
            >>> def my_evaluator(output, input, expected, metadata):
            ...     # Evaluator can access task output and example fields
            ...     score = calculate_similarity(output, expected)
            ...     return {"score": score, "label": "pass" if score > 0.8 else "fail"}
            >>> evaluated = evaluate_experiment(
            ...     experiment=experiment,
            ...     evaluators=[my_evaluator]
            ... )

        Direct client usage (equivalent):
            >>> from phoenix.client import Client
            >>> client = Client()
            >>> evaluated = client.experiments.evaluate_experiment(
            ...     experiment=experiment,
            ...     evaluators=[accuracy_evaluator]
            ... )
    """
    if client is None:
        from phoenix.client.client import Client

        client = Client()
    return client.experiments.evaluate_experiment(
        experiment=experiment,
        evaluators=evaluators,
        dry_run=dry_run,
        print_summary=print_summary,
        timeout=timeout,
        rate_limit_errors=rate_limit_errors,
    )


async def async_evaluate_experiment(
    *,
    experiment: RanExperiment,
    evaluators: ExperimentEvaluators,
    dry_run: bool = False,
    print_summary: bool = True,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    concurrency: int = 3,
    rate_limit_errors: Optional[RateLimitErrors] = None,
    client: Optional["AsyncClient"] = None,
) -> RanExperiment:
    """
    Run evaluators on a completed experiment (async version).

    An evaluator is either a synchronous or asynchronous function that returns an evaluation
    result object, which can take any of the following forms:

    - an EvaluationResult dict with optional fields for score, label, explanation and metadata
    - a `bool`, which will be interpreted as a score of 0 or 1 plus a label of "True" or "False"
    - a `float`, which will be interpreted as a score
    - a `str`, which will be interpreted as a label
    - a 2-`tuple` of (`float`, `str`), which will be interpreted as (score, explanation)

    If the `evaluator` is a function of one argument then that argument will be bound to the
    `output` of the task. Alternatively, the `evaluator` can be a function of any combination
    of specific argument names that will be bound to special values:

    - `input`: The input field of the dataset example
    - `output`: The output of the task
    - `expected`: The expected or reference output of the dataset example
    - `reference`: An alias for `expected`
    - `metadata`: Metadata associated with the dataset example

    Phoenix also provides pre-built evaluators in the `phoenix.experiments.evaluators` module.

    Args:
        experiment: The experiment to evaluate, returned from `run_experiment`.
        evaluators: A single evaluator or sequence of evaluators used to evaluate the results
            of the experiment.
        dry_run: Run the evaluation in dry-run mode. When set, evaluation results will not be
            recorded in Phoenix. Defaults to False.
        print_summary: Whether to print a summary of the evaluation results. Defaults to True.
        timeout: The timeout for the evaluation execution in seconds. Defaults to 60.
        concurrency: Specifies the concurrency for evaluation execution. Defaults to 3.
        rate_limit_errors: An exception or sequence of exceptions to adaptively throttle on.
            Defaults to None.
        client: A Phoenix client instance to use for the experiment. If not provided, a new client
            will be configured from environment variables. Defaults to None.

    Returns:
        A dictionary containing the evaluation results with the same format as async_run_experiment.

    Raises:
        ValueError: If no evaluators are provided or experiment has no runs.
        httpx.HTTPStatusError: If the API returns an error response.

    Example:
        Basic usage:
            >>> from phoenix.client.experiments import (
            ...     async_get_experiment,
            ...     async_evaluate_experiment,
            ... )
            >>> experiment = await async_get_experiment(experiment_id="123")
            >>> async def accuracy_evaluator(output, expected):
            ...     return 1.0 if output == expected else 0.0
            >>> evaluated = await async_evaluate_experiment(
            ...     experiment=experiment,
            ...     evaluators=[accuracy_evaluator]
            ... )

        Using dynamic binding for evaluators:
            >>> async def my_evaluator(output, input, expected, metadata):
            ...     # Evaluator can access task output and example fields
            ...     score = await calculate_similarity(output, expected)
            ...     return {"score": score, "label": "pass" if score > 0.8 else "fail"}
            >>> evaluated = await async_evaluate_experiment(
            ...     experiment=experiment,
            ...     evaluators=[my_evaluator],
            ...     concurrency=10
            ... )

        Direct client usage (equivalent):
            >>> from phoenix.client import AsyncClient
            >>> client = AsyncClient()
            >>> evaluated = await client.experiments.evaluate_experiment(
            ...     experiment=experiment,
            ...     evaluators=[accuracy_evaluator],
            ...     concurrency=5
            ... )
    """
    if client is None:
        from phoenix.client.client import AsyncClient

        client = AsyncClient()
    return await client.experiments.evaluate_experiment(
        experiment=experiment,
        evaluators=evaluators,
        dry_run=dry_run,
        print_summary=print_summary,
        timeout=timeout,
        concurrency=concurrency,
        rate_limit_errors=rate_limit_errors,
    )
