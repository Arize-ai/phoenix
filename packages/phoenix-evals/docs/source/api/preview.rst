evals 2.0
===============
.. contents:: :local:

Score
-----

Score 
~~~~~~
.. autoclass:: phoenix.evals.preview.Score
   :members:
   :exclude-members: name, score, label, explanation, metadata, source, direction
   :show-inheritance:

Evaluator Abstractions
----------------------

Evaluator Base
~~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.preview.Evaluator
   :members:
   :show-inheritance:

LLMEvaluator
~~~~~~~~~~~~
.. autoclass:: phoenix.evals.preview.LLMEvaluator
   :members:
   :show-inheritance:

ClassificationEvaluator
~~~~~~~~~~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.preview.ClassificationEvaluator
   :members:
   :show-inheritance:

BoundEvaluator
~~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.preview.BoundEvaluator
   :members:
   :show-inheritance:


Decorators
----------

create_evaluator
~~~~~~~~~~~~~~~~
.. autofunction:: phoenix.evals.preview.create_evaluator

LLM Interfaces
----------

LLM Wrapper
~~~~~~~~~~~
.. autoclass:: phoenix.evals.preview.llm.LLM
   :members:
   :show-inheritance:


Prompt Template
~~~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.preview.templating.Template
   :members:
   :show-inheritance:


Built-in Metrics
-------

HallucinationEvaluator
~~~~~~~~~~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.preview.metrics.HallucinationEvaluator
   :members:
   :show-inheritance:

ExactMatchEvaluator
~~~~~~~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.preview.metrics.ExactMatchEvaluator
   :members:
   :show-inheritance:

PrecisionRecallFScore
~~~~~~~~~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.preview.metrics.PrecisionRecallFScore
   :members:
   :show-inheritance:

Utilities
-----

remap_eval_input
~~~~~~~~~~~~~~~~
.. autofunction:: phoenix.evals.preview.utils.remap_eval_input

extract_with_jsonpath
~~~~~~~~~~~~~~~~~~~~~
.. autofunction:: phoenix.evals.preview.utils.extract_with_jsonpath  

bind_evaluator
~~~~~~~~~~~~~~
.. autofunction:: phoenix.evals.preview.bind_evaluator

Module Contents
---------------

.. automodule:: phoenix.evals.preview
   :members:
   :no-undoc-members: 