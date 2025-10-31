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
   :exclude-members: name, score, label, explanation, metadata, kind, direction
   :show-inheritance:


Built-in Metrics
------------------

.. automodule:: phoenix.evals.metrics
   :members:

Utilities
---------

.. automodule:: phoenix.evals.utils
   :members:
   :exclude-members: InputMappingType, download_benchmark_dataset, emoji_guard,  openai_function_call_kwargs, parse_openai_function_call, printif
