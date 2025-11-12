from typing import TYPE_CHECKING, Any, Mapping, Optional, Union

if TYPE_CHECKING:
    from phoenix.client.client import AsyncClient, Client
from phoenix.client.resources.datasets import Dataset
from phoenix.client.resources.experiments.evaluators import create_evaluator
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
    repetitions: int = 1,
    retries: int = 3,
    client: Optional["Client"] = None,
) -> RanExperiment:
    """
    Run an experiment using a given dataset of examples.

    An experiment is a user-defined task that runs on each example in a dataset.
    The results from each experiment can be evaluated using any number of
    evaluators to measure the behavior of the task. The experiment and
    evaluation results are stored in the Phoenix database for comparison and
    analysis.

    A `task` is a synchronous function that returns a JSON serializable output.
    If the `task` is a function of one argument then that argument will be bound
    to the `input` field of the dataset example. Alternatively, the `task` can
    be a function of any combination of specific argument names that will be
    bound to special values:

    - `input`: The input field of the dataset example
    - `expected`: The expected or reference output of the dataset example
    - `reference`: An alias for `expected`
    - `metadata`: Metadata associated with the dataset example
    - `example`: The dataset `Example` object with all associated fields

    An `evaluator` is either a synchronous function that returns an evaluation
    result object, which can take any of the following forms:

    - an EvaluationResult dict with optional fields for score, label,
      explanation and metadata
    - a `bool`, which will be interpreted as a score of 0 or 1 plus a label of
      "True" or "False"
    - a `float`, which will be interpreted as a score
    - a `str`, which will be interpreted as a label
    - a 2-`tuple` of (`float`, `str`), which will be interpreted as (score,
      explanation)

    If the `evaluator` is a function of one argument then that argument will be
    bound to the `output` of the task. Alternatively, the `evaluator` can be a
    function of any combination of specific argument names that will be bound to
    special values:

    - `input`: The input field of the dataset example
    - `output`: The output of the task
    - `expected`: The expected or reference output of the dataset example
    - `reference`: An alias for `expected`
    - `metadata`: Metadata associated with the dataset example
    - `example`: The dataset `Example` object with all associated fields

    Args:
        dataset (Dataset): The dataset on which to run the experiment.
        task (ExperimentTask): The task to run on each example in the dataset.
        evaluators (Optional[ExperimentEvaluators]): A single evaluator or sequence of
            evaluators used to evaluate the results of the experiment. Evaluators can be
            provided as a dict mapping names to functions, or as a list of functions (names
            will be auto-generated). Defaults to None.
        experiment_name (Optional[str]): The name of the experiment. Defaults to None.
        experiment_description (Optional[str]): A description of the experiment. Defaults to
            None.
        experiment_metadata (Optional[Mapping[str, Any]]): Metadata to associate with the
            experiment. Defaults to None.
        rate_limit_errors (Optional[RateLimitErrors]): An exception or sequence of exceptions to
            adaptively throttle on. Defaults to None.
        dry_run (Union[bool, int]): Run the experiment in dry-run mode. When set,
            experiment results will not be recorded in Phoenix. If True, the experiment will run
            on a random
            dataset example. If an integer, the experiment will run on a random sample of the
            dataset examples of the given size. Defaults to False.
        print_summary (bool): Whether to print a summary of the experiment and evaluation
            results. Defaults to True.
        timeout (Optional[int]): The timeout for the task execution in seconds. Use this to run
            longer tasks to avoid re-queuing the same task multiple times. Defaults to 60.
        repetitions (int): The number of times the task will be run on each example.
            Defaults to 1.
        retries (int): The number of times to retry a task if it fails. Defaults to 3.
        client (Optional[Client]): A Phoenix client instance to use for the experiment. If not
            provided, a new client will be configured from environment variables. Defaults to None.

    Returns:
        RanExperiment: A dictionary containing the experiment results.

    Raises:
        ValueError: If dataset format is invalid or has no examples.
        httpx.HTTPStatusError: If the API returns an error response.

    Examples:
        Basic usage::

            from phoenix.client.experiments import run_experiment
            from phoenix.client import Client

            client = Client()
            dataset = client.datasets.get_dataset(dataset="my-dataset")

            def my_task(input):
                return f"Hello {input['name']}"

            experiment = run_experiment(
                dataset=dataset, task=my_task,
                experiment_name="greeting-experiment"
            ) print(f"Experiment completed with {len(experiment.runs)} runs")

        With client configuration::

            from phoenix.client import Client
            client = Client()

            experiment = run_experiment(
                client=client, dataset=dataset, task=my_task,
                experiment_name="greeting-experiment"
            )

        With evaluators::

            def accuracy_evaluator(output, expected):
                return 1.0 if output == expected['text'] else 0.0

            experiment = run_experiment(
                dataset=dataset, task=my_task, evaluators=[accuracy_evaluator],
                experiment_name="evaluated-experiment"
            )

        With dataset splits::

            # Get only the training split
            train_dataset = client.datasets.get_dataset(
                dataset="my-dataset", splits=["train"]
            )
            print(f"Running on splits: {train_dataset.split_names}")

            experiment = run_experiment(
                dataset=train_dataset, task=my_task,
                experiment_name="train-split-experiment"
            )

        Using dynamic binding for tasks::

            def my_task(input, metadata, expected):
                # Task can access multiple fields from the dataset example
                context = metadata.get("context", "")
                return f"Context: {context}, Input: {input}, Expected: {expected}"

            experiment = run_experiment(
                dataset=dataset, task=my_task, experiment_name="dynamic-task"
            )

        Using dynamic binding for evaluators::

            def my_evaluator(output, input, expected, metadata):
                # Evaluator can access task output and example fields score =
                calculate_similarity(output, expected)
                return {"score": score, "label": "pass" if score > 0.8 else "fail"}

            experiment = run_experiment(
                dataset=dataset, task=my_task, evaluators=[my_evaluator],
                experiment_name="dynamic-evaluator"
            )
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
        repetitions=repetitions,
        retries=retries,
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
    repetitions: int = 1,
    retries: int = 3,
    client: Optional["AsyncClient"] = None,
) -> RanExperiment:
    """
    Run an experiment using a given dataset of examples.

    An experiment is a user-defined task that runs on each example in a dataset.
    The results from each experiment can be evaluated using any number of
    evaluators to measure the behavior of the task. The experiment and
    evaluation results are stored in the Phoenix database for comparison and
    analysis.

    A `task` is either a synchronous or asynchronous function that returns a
    JSON serializable output. If the `task` is a function of one argument then
    that argument will be bound to the `input` field of the dataset example.
    Alternatively, the `task` can be a function of any combination of specific
    argument names that will be bound to special values:

    - `input`: The input field of the dataset example
    - `expected`: The expected or reference output of the dataset example
    - `reference`: An alias for `expected`
    - `metadata`: Metadata associated with the dataset example
    - `example`: The dataset `Example` object with all associated fields

    An `evaluator` is either a synchronous or asynchronous function that returns
    an evaluation result object, which can take any of the following forms:

    - an EvaluationResult dict with optional fields for score, label,
      explanation and metadata
    - a `bool`, which will be interpreted as a score of 0 or 1 plus a label of
      "True" or "False"
    - a `float`, which will be interpreted as a score
    - a `str`, which will be interpreted as a label
    - a 2-`tuple` of (`float`, `str`), which will be interpreted as (score,
      explanation)

    If the `evaluator` is a function of one argument then that argument will be
    bound to the `output` of the task. Alternatively, the `evaluator` can be a
    function of any combination of specific argument names that will be bound to
    special values:

    - `input`: The input field of the dataset example
    - `output`: The output of the task
    - `expected`: The expected or reference output of the dataset example
    - `reference`: An alias for `expected`
    - `metadata`: Metadata associated with the dataset example
    - `example`: The dataset `Example` object with all associated fields

    Args:
        dataset (Dataset): The dataset on which to run the experiment.
        task (ExperimentTask): The task to run on each example in the dataset.
        evaluators (Optional[ExperimentEvaluators]): A single evaluator or sequence of
            evaluators used to evaluate the results of the experiment. Evaluators can be
            provided as a dict mapping names to functions, or as a list of functions (names
            will be auto-generated). Defaults to None.
        experiment_name (Optional[str]): The name of the experiment. Defaults to None.
        experiment_description (Optional[str]): A description of the experiment. Defaults to
            None.
        experiment_metadata (Optional[Mapping[str, Any]]): Metadata to associate with the
            experiment. Defaults to None.
        rate_limit_errors (Optional[RateLimitErrors]): An exception or sequence of exceptions to
            adaptively throttle on. Defaults to None.
        dry_run (Union[bool, int]): Run the experiment in dry-run mode. When set,
            experiment results will not be recorded in Phoenix. If True, the experiment will run
            on a random
            dataset example. If an integer, the experiment will run on a random sample of the
            dataset examples of the given size. Defaults to False.
        print_summary (bool): Whether to print a summary of the experiment and evaluation
            results. Defaults to True.
        concurrency (int): Specifies the concurrency for task execution. Defaults to 3.
        timeout (Optional[int]): The timeout for the task execution in seconds. Use this to run
            longer tasks to avoid re-queuing the same task multiple times. Defaults to 60.
        repetitions (int): The number of times the task will be run on each example.
            Defaults to 1.
        retries (int): The number of times to retry a task if it fails. Defaults to 3.
        client (Optional[AsyncClient]): A Phoenix async client instance to use for the experiment.
            If not provided, a new client will be configured from environment variables. Defaults
            to None.

    Returns:
        RanExperiment: A dictionary containing the experiment results.

    Raises:
        ValueError: If dataset format is invalid or has no examples.
        httpx.HTTPStatusError: If the API returns an error response.

    Examples:
        Basic usage::

            from phoenix.client.experiments import async_run_experiment
            from phoenix.client import AsyncClient

            client = AsyncClient()
            dataset = await client.datasets.get_dataset(dataset="my-dataset")

            async def my_task(input):
                return f"Hello {input['name']}"

            experiment = await async_run_experiment(
                dataset=dataset, task=my_task,
                experiment_name="greeting-experiment"
            )
            print(f"Experiment completed with {len(experiment.runs)} runs")

        With client configuration::

            from phoenix.client import AsyncClient
            client = AsyncClient()

            experiment = await async_run_experiment(
                client=client, dataset=dataset, task=my_task,
                experiment_name="greeting-experiment"
            )

        With evaluators::

            async def accuracy_evaluator(output, expected):
                return 1.0 if output == expected['text'] else 0.0

            experiment = await async_run_experiment(
                dataset=dataset, task=my_task, evaluators=[accuracy_evaluator],
                experiment_name="evaluated-experiment"
            )

        With dataset splits::

            # Get only the training split
            train_dataset = await client.datasets.get_dataset(
                dataset="my-dataset", splits=["train"]
            )
            print(f"Running on splits: {train_dataset.split_names}")

            experiment = await async_run_experiment(
                dataset=train_dataset, task=my_task,
                experiment_name="train-split-experiment"
            )

        Using dynamic binding for tasks::

            async def my_task(input, metadata, expected):
                # Task can access multiple fields from the dataset example
                context = metadata.get("context", "")
                return f"Context: {context}, Input: {input}, Expected: {expected}"

            experiment = await async_run_experiment(
                dataset=dataset, task=my_task, experiment_name="dynamic-task",
                concurrency=5
            )

        Using dynamic binding for evaluators::

            async def my_evaluator(output, input, expected, metadata):
                # Evaluator can access task output and example fields score =
                await calculate_similarity(output, expected)
                return {"score": score, "label": "pass" if score > 0.8 else "fail"}

            experiment = await async_run_experiment(
                dataset=dataset, task=my_task, evaluators=[my_evaluator],
                experiment_name="dynamic-evaluator", concurrency=10
            )
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
        repetitions=repetitions,
        retries=retries,
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
        experiment_id (str): The ID of the experiment to retrieve.
        client (Optional[Client]): A Phoenix client instance to use for the experiment. If not
            provided, a new client will be configured from environment variables. Defaults to None.

    Returns:
        RanExperiment: A RanExperiment object containing the experiment data, task runs, and
            evaluation runs.

    Raises:
        ValueError: If the experiment is not found.
        httpx.HTTPStatusError: If the API returns an error response.

    Examples:
        Basic usage::

            from phoenix.client.experiments import get_experiment

            # Get a completed experiment
            experiment = get_experiment(experiment_id="123")
            print(f"Experiment: {experiment.experiment_name}")
            print(f"Total runs: {len(experiment.runs)}")

        Using with evaluate_experiment::

            from phoenix.client.experiments import get_experiment, evaluate_experiment

            # Get experiment and run additional evaluations
            experiment = get_experiment(experiment_id="123")
            evaluated = evaluate_experiment(
                experiment=experiment,
                evaluators=[correctness_evaluator],
                print_summary=True,
            )

        Direct client usage (equivalent)::

            from phoenix.client import Client
            client = Client()

            experiment = client.experiments.get_experiment(experiment_id="123")
    """
    if client is None:
        from phoenix.client.client import Client

        client = Client()
    return client.experiments.get_experiment(experiment_id=experiment_id)


def resume_experiment(
    *,
    experiment_id: str,
    task: ExperimentTask,
    evaluators: Optional[ExperimentEvaluators] = None,
    print_summary: bool = True,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    rate_limit_errors: Optional[RateLimitErrors] = None,
    retries: int = 3,
    client: Optional["Client"] = None,
) -> None:
    """
    Resume an incomplete experiment by running only the missing or failed runs.

    This method identifies which (example, repetition) pairs have not been completed
    (either missing or failed) and re-runs the task only for those pairs. Optionally,
    evaluators can be run on the completed runs after task execution.

    The method processes incomplete runs in batches using pagination to minimize memory usage.

    .. note::
        Multi-output evaluators (evaluators that return a list/sequence of results) are not
        supported for resume operations. Each evaluator should produce a single evaluation
        result with a name matching the evaluator's key in the dictionary.

    Args:
        experiment_id (str): The ID of the experiment to resume.
        task (ExperimentTask): The task to run on incomplete examples.
        evaluators (Optional[ExperimentEvaluators]): Optional evaluators to run on completed
            task runs. Evaluators can be provided as a dict mapping names to functions, or as
            a list of functions (names will be auto-generated). Defaults to None.
        print_summary (bool): Whether to print a summary of the results. Defaults to True.
        timeout (Optional[int]): The timeout for task execution in seconds. Defaults to 60.
        rate_limit_errors (Optional[RateLimitErrors]): An exception or sequence of exceptions
            to adaptively throttle on. Defaults to None.
        retries (int): The number of times to retry a task if it fails. Defaults to 3.
        client (Optional[Client]): A Phoenix client instance to use for the experiment. If not
            provided, a new client will be configured from environment variables. Defaults to
            None.

    Returns:
        None

    Raises:
        ValueError: If the experiment is not found.
        httpx.HTTPStatusError: If the API returns an error response.

    Example::
        from phoenix.experiments import resume_experiment

        # Resume an interrupted experiment
        resume_experiment(
            experiment_id="exp_123",
            task=my_task,
        )

        # Resume with evaluators
        resume_experiment(
            experiment_id="exp_123",
            task=my_task,
            evaluators={"quality": my_evaluator},
        )
    """
    if client is None:
        from phoenix.client.client import Client

        client = Client()
    return client.experiments.resume_experiment(
        experiment_id=experiment_id,
        task=task,
        evaluators=evaluators,
        print_summary=print_summary,
        timeout=timeout,
        rate_limit_errors=rate_limit_errors,
        retries=retries,
    )


async def async_get_experiment(
    *,
    experiment_id: str,
    client: Optional["AsyncClient"] = None,
) -> RanExperiment:
    """
    Get a completed experiment by ID.

    This function retrieves a completed experiment with all its task runs and
    evaluation runs, returning a RanExperiment object that can be used with
    async_evaluate_experiment to run additional evaluations.

    Args:
        experiment_id (str): The ID of the experiment to retrieve.
        client (Optional[AsyncClient]): A Phoenix async client instance to use for the experiment.
            If not provided, a new client will be configured from environment variables. Defaults
            to None.

    Returns:
        RanExperiment: A RanExperiment object containing the experiment data,
        task runs, and
            evaluation runs.

    Raises:
        ValueError: If the experiment is not found. httpx.HTTPStatusError: If
        the API returns an error response.

    Examples:
        Basic usage::

            from phoenix.client.experiments import async_get_experiment

            # Get a completed experiment experiment = await
            async_get_experiment(experiment_id="123")
            print(
                f"Experiment: {experiment.experiment_name}",
                f"Total runs: {len(experiment.runs)}",
            )

        Using with async_evaluate_experiment::

            from phoenix.client.experiments import (
                async_get_experiment, async_evaluate_experiment,
            )

            # Get experiment and run additional evaluations experiment = await
            async_get_experiment(experiment_id="123") evaluated = await
            async_evaluate_experiment(
                experiment=experiment,
                evaluators=[correctness_evaluator],
                print_summary=True,
            )
    """
    if client is None:
        from phoenix.client.client import AsyncClient

        client = AsyncClient()
    return await client.experiments.get_experiment(experiment_id=experiment_id)


async def async_resume_experiment(
    *,
    experiment_id: str,
    task: ExperimentTask,
    evaluators: Optional[ExperimentEvaluators] = None,
    print_summary: bool = True,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    concurrency: int = 3,
    rate_limit_errors: Optional[RateLimitErrors] = None,
    retries: int = 3,
    client: Optional["AsyncClient"] = None,
) -> None:
    """
    Resume an incomplete experiment by running only the missing or failed runs.

    This method identifies which (example, repetition) pairs have not been completed
    (either missing or failed) and re-runs the task only for those pairs. Optionally,
    evaluators can be run on the completed runs after task execution.

    The method processes incomplete runs in batches using pagination to minimize memory usage.

    .. note::
        Multi-output evaluators (evaluators that return a list/sequence of results) are not
        supported for resume operations. Each evaluator should produce a single evaluation
        result with a name matching the evaluator's key in the dictionary.

    Args:
        experiment_id (str): The ID of the experiment to resume.
        task (ExperimentTask): The task to run on incomplete examples.
        evaluators (Optional[ExperimentEvaluators]): Optional evaluators to run on completed
            task runs. Evaluators can be provided as a dict mapping names to functions, or as
            a list of functions (names will be auto-generated). Defaults to None.
        print_summary (bool): Whether to print a summary of the results. Defaults to True.
        timeout (Optional[int]): The timeout for task execution in seconds. Defaults to 60.
        concurrency (int): The number of concurrent tasks to run. Defaults to 3.
        rate_limit_errors (Optional[RateLimitErrors]): An exception or sequence of exceptions
            to adaptively throttle on. Defaults to None.
        retries (int): The number of times to retry a task if it fails. Defaults to 3.
        client (Optional[AsyncClient]): A Phoenix async client instance to use for the experiment.
            If not provided, a new client will be configured from environment variables. Defaults
            to None.

    Returns:
        None

    Raises:
        ValueError: If the experiment is not found.
        httpx.HTTPStatusError: If the API returns an error response.

    Example::

        from phoenix.client.experiments import async_resume_experiment

        # Resume an interrupted experiment
        await async_resume_experiment(
            experiment_id="exp_123",
            task=my_async_task,
        )

        # Resume with evaluators
        await async_resume_experiment(
            experiment_id="exp_123",
            task=my_async_task,
            evaluators={"quality": my_evaluator},
        )
    """
    if client is None:
        from phoenix.client.client import AsyncClient

        client = AsyncClient()
    return await client.experiments.resume_experiment(
        experiment_id=experiment_id,
        task=task,
        evaluators=evaluators,
        print_summary=print_summary,
        timeout=timeout,
        concurrency=concurrency,
        rate_limit_errors=rate_limit_errors,
        retries=retries,
    )


def evaluate_experiment(
    *,
    experiment: RanExperiment,
    evaluators: ExperimentEvaluators,
    dry_run: bool = False,
    print_summary: bool = True,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    rate_limit_errors: Optional[RateLimitErrors] = None,
    retries: int = 3,
    client: Optional["Client"] = None,
) -> RanExperiment:
    """
    Run evaluators on a completed experiment.

    An evaluator is either a synchronous or asynchronous function that returns
    an evaluation result object, which can take any of the following forms:

    - an EvaluationResult dict with optional fields for score, label,
      explanation and metadata
    - a `bool`, which will be interpreted as a score of 0 or 1 plus a label of
      "True" or "False"
    - a `float`, which will be interpreted as a score
    - a `str`, which will be interpreted as a label
    - a 2-`tuple` of (`float`, `str`), which will be interpreted as (score,
      explanation)

    If the `evaluator` is a function of one argument then that argument will be
    bound to the `output` of the task. Alternatively, the `evaluator` can be a
    function of any combination of specific argument names that will be bound to
    special values:

    - `input`: The input field of the dataset example
    - `output`: The output of the task
    - `expected`: The expected or reference output of the dataset example
    - `reference`: An alias for `expected`
    - `metadata`: Metadata associated with the dataset example
    - `example`: The dataset `Example` object with all associated fields

    Args:
        experiment (RanExperiment): The experiment to evaluate, returned from `run_experiment`.
        evaluators (ExperimentEvaluators): A single evaluator or sequence of evaluators
            used to evaluate the results of the experiment. Evaluators can be provided as a
            dict mapping names to functions, or as a list of functions (names will be
            auto-generated).
        dry_run (bool): Run the evaluation in dry-run mode. When set, evaluation results will
            not be recorded in Phoenix. Defaults to False.
        print_summary (bool): Whether to print a summary of the evaluation results.
            Defaults to True.
        timeout (Optional[int]): The timeout for the evaluation execution in seconds.
            Defaults to 60.
        concurrency (int): Specifies the concurrency for evaluation execution. Defaults to 3.
        rate_limit_errors (Optional[RateLimitErrors]): An exception or sequence of exceptions
            to adaptively throttle on.
            Defaults to None.
        retries (int): The number of times to retry a task if it fails. Defaults to 3.
        client (Optional[Client]): A Phoenix client instance to use for the experiment. If not
            provided, a new client will be configured from environment variables. Defaults to None.

    Returns:
        RanExperiment: A dictionary containing the evaluation results with the same format
            as run_experiment.

    Raises:
        ValueError: If no evaluators are provided or experiment has no runs.
        httpx.HTTPStatusError: If the API returns an error response.

    Examples:
        Basic usage::

            from phoenix.client.experiments import get_experiment,
            evaluate_experiment

            # Get experiment and evaluate it experiment =
            get_experiment(experiment_id="123")

            def accuracy_evaluator(output, expected):
                return 1.0 if output == expected else 0.0

            evaluated = evaluate_experiment(
                experiment=experiment, evaluators=[accuracy_evaluator]
            ) print(f"Evaluation completed for {len(evaluated.runs)} runs")

        Using dynamic binding for evaluators::

            def my_evaluator(output, input, expected, metadata):
                # Evaluator can access task output and example fields score =
                calculate_similarity(output, expected) return {"score": score,
                "label": "pass" if score > 0.8 else "fail"}

            evaluated = evaluate_experiment(
                experiment=experiment, evaluators=[my_evaluator]
            )

        Direct client usage (equivalent)::

            from phoenix.client import Client client = Client()

            evaluated = client.experiments.evaluate_experiment(
                experiment=experiment, evaluators=[accuracy_evaluator]
            )
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
        retries=retries,
    )


def resume_evaluation(
    *,
    experiment_id: str,
    evaluators: ExperimentEvaluators,
    print_summary: bool = True,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    rate_limit_errors: Optional[RateLimitErrors] = None,
    retries: int = 3,
    client: Optional["Client"] = None,
) -> None:
    """
    Resume incomplete evaluations for an experiment.

    This method identifies which evaluations have not been completed (either missing or failed)
    and runs the evaluators only for those runs. This is useful for:
    - Recovering from transient evaluator failures
    - Adding new evaluators to completed experiments
    - Completing partially evaluated experiments

    The method processes incomplete evaluations in batches using pagination
    to minimize memory usage.

    Evaluation names are matched to evaluator dict keys. For example,
    if you pass ``{"accuracy": accuracy_fn}``, it will check for and resume any runs
    missing the "accuracy" evaluation.

    .. note::
        Multi-output evaluators (evaluators that return a list/sequence of results) are not
        supported for resume operations. Each evaluator should produce a single evaluation
        result with a name matching the evaluator's key in the dictionary.

    Args:
        experiment_id (str): The ID of the experiment to resume evaluations for.
        evaluators (ExperimentEvaluators): A single evaluator or sequence of evaluators
            to run. Evaluators can be provided as a dict mapping names to functions,
            or as a list of functions (names will be auto-generated).
        print_summary (bool): Whether to print a summary of evaluation results.
            Defaults to True.
        timeout (Optional[int]): The timeout for evaluation execution in seconds.
            Defaults to 60.
        rate_limit_errors (Optional[RateLimitErrors]): An exception or sequence of
            exceptions to adaptively throttle on. Defaults to None.
        retries (int): The number of times to retry a task if it fails. Defaults to 3.
        client (Optional[Client]): A Phoenix client instance to use for the experiment. If not
            provided, a new client will be configured from environment variables. Defaults to None.

    Raises:
        ValueError: If the experiment is not found or no evaluators are provided.
        httpx.HTTPStatusError: If the API returns an error response.

    Example::

        from phoenix.client.experiments import resume_evaluation

        def accuracy(output, expected):
            return 1.0 if output == expected else 0.0

        # Standard usage: evaluation name matches evaluator key
        resume_evaluation(
            experiment_id="exp_123",
            evaluators={"accuracy": accuracy},
        )
    """
    if client is None:
        from phoenix.client.client import Client

        client = Client()
    return client.experiments.resume_evaluation(
        experiment_id=experiment_id,
        evaluators=evaluators,
        print_summary=print_summary,
        timeout=timeout,
        rate_limit_errors=rate_limit_errors,
        retries=retries,
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
    retries: int = 3,
    client: Optional["AsyncClient"] = None,
) -> RanExperiment:
    """
    Run evaluators on a completed experiment.

    An `evaluator` is either a synchronous or asynchronous function that returns an evaluation
    result object, which can take any of the following forms:

    - an EvaluationResult dict with optional fields for score, label, explanation and metadata
    - a `bool`, which will be interpreted as a score of 0 or 1 plus a label of "True" or "False"
    - a `float`, which will be interpreted as a score
    - a `str`, which will be interpreted as a label
    - a 2-`tuple` of (`float`, `str`), which will be interpreted as (score, explanation)

    Args:
        experiment (RanExperiment): The experiment to evaluate, returned from `run_experiment`.
        evaluators (ExperimentEvaluators): A single evaluator or sequence of evaluators
            used to evaluate the results of the experiment. Evaluators can be provided as a
            dict mapping names to functions, or as a list of functions (names will be
            auto-generated).
        dry_run (bool): Run the evaluation in dry-run mode. When set, evaluation results will
            not be recorded in Phoenix. Defaults to False.
        print_summary (bool): Whether to print a summary of the evaluation results.
            Defaults to True.
        timeout (Optional[int]): The timeout for the evaluation execution in seconds.
            Defaults to 60.
        concurrency (int): Specifies the concurrency for evaluation execution. Defaults to 3.
        rate_limit_errors (Optional[RateLimitErrors]): An exception or sequence of exceptions
            to adaptively throttle on.
            Defaults to None.
        retries (int): The number of times to retry a task if it fails. Defaults to 3.
        client (Optional[AsyncClient]): A Phoenix async client instance to use for the experiment.
            If not provided, a new client will be configured from environment variables. Defaults
            to None.

    Returns:
        RanExperiment: A dictionary containing the evaluation results with the same format
            as run_experiment.

    Raises:
        ValueError: If no evaluators are provided or experiment has no runs.
        httpx.HTTPStatusError: If the API returns an error response.
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
        retries=retries,
    )


async def async_resume_evaluation(
    *,
    experiment_id: str,
    evaluators: ExperimentEvaluators,
    print_summary: bool = True,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
    concurrency: int = 3,
    rate_limit_errors: Optional[RateLimitErrors] = None,
    retries: int = 3,
    client: Optional["AsyncClient"] = None,
) -> None:
    """
    Resume incomplete evaluations for an experiment (async version).

    This method identifies which evaluations have not been completed (either missing or failed)
    and runs the evaluators only for those runs. This is useful for:
    - Recovering from transient evaluator failures
    - Adding new evaluators to completed experiments
    - Completing partially evaluated experiments

    The method processes incomplete evaluations in batches using pagination
    to minimize memory usage.

    Evaluation names are matched to evaluator dict keys. For example,
    if you pass ``{"accuracy": accuracy_fn}``, it will check for and resume any runs
    missing the "accuracy" evaluation.

    .. note::
        Multi-output evaluators (evaluators that return a list/sequence of results) are not
        supported for resume operations. Each evaluator should produce a single evaluation
        result with a name matching the evaluator's key in the dictionary.

    Args:
        experiment_id (str): The ID of the experiment to resume evaluations for.
        evaluators (ExperimentEvaluators): A single evaluator or sequence of evaluators
            to run. Evaluators can be provided as a dict mapping names to functions,
            or as a list of functions (names will be auto-generated).
        print_summary (bool): Whether to print a summary of evaluation results.
            Defaults to True.
        timeout (Optional[int]): The timeout for evaluation execution in seconds.
            Defaults to 60.
        concurrency (int): The number of concurrent evaluations to run. Defaults to 3.
        rate_limit_errors (Optional[RateLimitErrors]): An exception or sequence of
            exceptions to adaptively throttle on. Defaults to None.
        retries (int): The number of times to retry a task if it fails. Defaults to 3.
        client (Optional[AsyncClient]): A Phoenix async client instance to use for the experiment.
            If not provided, a new client will be configured from environment variables. Defaults
            to None.

    Raises:
        ValueError: If the experiment is not found or no evaluators are provided.
        httpx.HTTPStatusError: If the API returns an error response.

    Example::

        from phoenix.client.experiments import async_resume_evaluation

        async def accuracy(output, expected):
            return 1.0 if output == expected else 0.0

        # Standard usage: evaluation name matches evaluator key
        await async_resume_evaluation(
            experiment_id="exp_123",
            evaluators={"accuracy": accuracy},
        )
    """
    if client is None:
        from phoenix.client.client import AsyncClient

        client = AsyncClient()
    return await client.experiments.resume_evaluation(
        experiment_id=experiment_id,
        evaluators=evaluators,
        print_summary=print_summary,
        timeout=timeout,
        concurrency=concurrency,
        rate_limit_errors=rate_limit_errors,
        retries=retries,
    )


__all__ = [
    "run_experiment",
    "async_run_experiment",
    "get_experiment",
    "async_get_experiment",
    "resume_experiment",
    "async_resume_experiment",
    "resume_evaluation",
    "async_resume_evaluation",
    "evaluate_experiment",
    "async_evaluate_experiment",
    "create_evaluator",
]
