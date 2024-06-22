import inspect
from inspect import signature

from phoenix.datasets.types import JSONSerializable


def _unwrap_json(obj: JSONSerializable) -> JSONSerializable:
    if isinstance(obj, dict):
        if len(obj) == 1:
            key = next(iter(obj.keys()))
            output = obj[key]
            assert isinstance(
                output, (dict, list, str, int, float, bool, type(None))
            ), "Output must be JSON serializable"
            return output
    return obj


def evaluator(name: str, annotator_kind: str):
    def wrapper(func):
        wrapped_signature = inspect.signature(func)

        if inspect.iscoroutinefunction(func):
            return _wrap_coroutine_evaluation_function(name, annotator_kind, wrapped_signature)(func)
        else:
            return _wrap_sync_evaluation_function(name, annotator_kind, wrapped_signature)(func)

    return wrapper


def _wrap_coroutine_evaluation_function(name, annotator_kind, sig):
    def wrapper(func):
        class AsyncEvaluator:
            def __init__(self):
                self.name = name
                self.annotator_kind = annotator_kind

            async def __call__(*args, **kwargs):
                return await func(*args, **kwargs)

            async def async_evaluate(self, example, exp_run):
                bound_signature = self._bind(example, exp_run)
                return await func(*bound_signature.args, **bound_signature.kwargs)

            def _bind(self, example, exp_run):
                params = sig.parameters
                if len(params) == 1:
                    if "example" in params:
                        return sig.bind_partial(example=example)
                    elif "experiment_run" in params:
                        return sig.bind_partial(experiment_run=exp_run)
                    else:
                        return sig.bind(exp_run.output)
                else:
                    return sig.bind_partial(example=example, experiment_run=exp_run)

        return AsyncEvaluator()
    return wrapper


def _wrap_sync_evaluation_function(name, annotator_kind, sig):
    def wrapper(func):
        class SyncEvaluator:
            def __init__(self):
                self.name = name
                self.annotator_kind = annotator_kind

            def __call__(*args, **kwargs):
                return func(*args, **kwargs)

            def evaluate(self, example, exp_run):
                bound_signature = self._bind(example, exp_run)
                return func(*bound_signature.args, **bound_signature.kwargs)

            def _bind(self, example, exp_run):
                params = sig.parameters
                if len(params) == 1:
                    if "example" in params:
                        return sig.bind_partial(example=example)
                    elif "experiment_run" in params:
                        return sig.bind_partial(experiment_run=exp_run)
                    else:
                        return sig.bind(exp_run.output)
                else:
                    return sig.bind_partial(example=example, experiment_run=exp_run)

        return SyncEvaluator()
    return wrapper
