Evals
===============
.. contents:: :local:


LLM Interfaces
------------------

LLM
~~~~~~~~~~~
.. autoclass:: phoenix.evals.llm.LLM
   :members:
   :show-inheritance:


Prompt Template
~~~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.templating.Template
   :members:
   :show-inheritance:


Evaluator Abstractions
----------------------

Evaluator Base
~~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.Evaluator
   :members:
   :show-inheritance:

LLMEvaluator
~~~~~~~~~~~~
.. autoclass:: phoenix.evals.LLMEvaluator
   :members:
   :show-inheritance:

ClassificationEvaluator
~~~~~~~~~~~~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.ClassificationEvaluator
   :members:
   :show-inheritance:

Core Functions
--------------

create_evaluator
~~~~~~~~~~~~~~~~
.. autofunction:: phoenix.evals.create_evaluator

create_classifier
~~~~~~~~~~~~~~~~~
.. autofunction:: phoenix.evals.create_classifier


bind_evaluator
~~~~~~~~~~~~~~
.. autofunction:: phoenix.evals.bind_evaluator

evaluate_dataframe
~~~~~~~~~~~~~~~~~~
.. autofunction:: phoenix.evals.evaluators.evaluate_dataframe

async_evaluate_dataframe
~~~~~~~~~~~~~~~~~~~~~~~~
.. autofunction:: phoenix.evals.evaluators.async_evaluate_dataframe


Score
-----

Score 
~~~~~~
.. autoclass:: phoenix.evals.Score
   :members:
   :exclude-members: name, score, label, explanation, metadata, source, direction
   :show-inheritance:


Built-in Metrics
------------------

HallucinationEvaluator
~~~~~~~~~~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.metrics.HallucinationEvaluator
   :members:
   :show-inheritance:

exact_match
~~~~~~~~~~~
.. autofunction:: phoenix.evals.metrics.exact_match

PrecisionRecallFScore
~~~~~~~~~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.metrics.PrecisionRecallFScore
   :members:
   :show-inheritance:

Utilities
---------

remap_eval_input
~~~~~~~~~~~~~~~~
.. autofunction:: phoenix.evals.utils.remap_eval_input

extract_with_jsonpath
~~~~~~~~~~~~~~~~~~~~~
.. autofunction:: phoenix.evals.utils.extract_with_jsonpath  

to_annotation_dataframe
~~~~~~~~~~~~~~~~~~~~~~~~
.. autofunction:: phoenix.evals.utils.to_annotation_dataframe