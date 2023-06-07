from enum import Enum
from functools import partial

import strawberry
from sklearn import metrics

from phoenix.metrics.wrappers import ClassificationEval, Eval, ScoredClassificationEval


@strawberry.enum
class PerformanceMetric(Enum):
    # NOTE: Strawberry (version 0.178.0) only recognizes these
    # functions as enum values when they're placed inside `partial`.
    accuracy_score = partial(ClassificationEval(metrics.accuracy_score))
    average_precision_score = partial(ScoredClassificationEval(metrics.average_precision_score))
    balanced_accuracy_score = partial(ClassificationEval(metrics.balanced_accuracy_score))
    brier_score_loss = partial(ScoredClassificationEval(metrics.brier_score_loss))
    d2_absolute_error_score = partial(Eval(metrics.d2_absolute_error_score))
    d2_pinball_score = partial(Eval(metrics.d2_pinball_score))
    d2_tweedie_score = partial(Eval(metrics.d2_tweedie_score))
    explained_variance_score = partial(Eval(metrics.explained_variance_score))
    f1_score = partial(ClassificationEval(metrics.f1_score))
    hamming_loss = partial(ClassificationEval(metrics.hamming_loss))
    jaccard_score = partial(ClassificationEval(metrics.jaccard_score))
    log_loss = partial(ScoredClassificationEval(metrics.log_loss))
    matthews_corrcoef = partial(ClassificationEval(metrics.matthews_corrcoef))
    max_error = partial(Eval(metrics.max_error))
    mean_absolute_error = partial(Eval(metrics.mean_absolute_error))
    mean_absolute_percentage_error = partial(Eval(metrics.mean_absolute_percentage_error))
    mean_gamma_deviance = partial(Eval(metrics.mean_gamma_deviance))
    mean_pinball_loss = partial(Eval(metrics.mean_pinball_loss))
    mean_poisson_deviance = partial(Eval(metrics.mean_poisson_deviance))
    mean_squared_error = partial(Eval(metrics.mean_squared_error))
    mean_squared_log_error = partial(Eval(metrics.mean_squared_log_error))
    mean_tweedie_deviance = partial(Eval(metrics.mean_tweedie_deviance))
    median_absolute_error = partial(Eval(metrics.median_absolute_error))
    precision_score = partial(ClassificationEval(metrics.precision_score))
    r2_score = partial(Eval(metrics.r2_score))
    recall_score = partial(ClassificationEval(metrics.recall_score))
    roc_auc_score = partial(ScoredClassificationEval(metrics.roc_auc_score))
    root_mean_squared_error = partial(Eval(metrics.mean_squared_error), squared=False)
    zero_one_loss = partial(ClassificationEval(metrics.zero_one_loss))
