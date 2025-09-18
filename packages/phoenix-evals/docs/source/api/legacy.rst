Evals Legacy
=====

.. contents:: :local:

Core Functions
--------------

llm_classify
~~~~~~~~~~~~
.. autofunction:: phoenix.evals.llm_classify

llm_generate
~~~~~~~~~~~~
.. autofunction:: phoenix.evals.llm_generate

run_evals
~~~~~~~~~
.. autofunction:: phoenix.evals.run_evals

Evaluators
----------

LLMEvaluator
~~~~~~~~~~~~
.. autoclass:: phoenix.evals.LLMEvaluator
   :members:
   :show-inheritance:

HallucinationEvaluator
~~~~~~~~~~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.HallucinationEvaluator
   :members:
   :show-inheritance:

QAEvaluator
~~~~~~~~~~~
.. autoclass:: phoenix.evals.QAEvaluator
   :members:
   :show-inheritance:

RelevanceEvaluator
~~~~~~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.RelevanceEvaluator
   :members:
   :show-inheritance:

ToxicityEvaluator
~~~~~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.ToxicityEvaluator
   :members:
   :show-inheritance:

SummarizationEvaluator
~~~~~~~~~~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.SummarizationEvaluator
   :members:
   :show-inheritance:

SQLEvaluator
~~~~~~~~~~~~
.. autoclass:: phoenix.evals.SQLEvaluator
   :members:
   :show-inheritance:

Models
------

OpenAIModel
~~~~~~~~~~~
.. autoclass:: phoenix.evals.OpenAIModel
   :members:
   :show-inheritance:

AnthropicModel
~~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.AnthropicModel
   :members:
   :show-inheritance:

GeminiModel
~~~~~~~~~~~
.. autoclass:: phoenix.evals.GeminiModel
   :members:
   :show-inheritance:

GoogleGenAIModel
~~~~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.GoogleGenAIModel
   :members:
   :show-inheritance:

VertexAIModel
~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.VertexAIModel
   :members:
   :show-inheritance:

BedrockModel
~~~~~~~~~~~~
.. autoclass:: phoenix.evals.BedrockModel
   :members:
   :show-inheritance:

LiteLLMModel
~~~~~~~~~~~~
.. autoclass:: phoenix.evals.LiteLLMModel
   :members:
   :show-inheritance:

MistralAIModel
~~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.MistralAIModel
   :members:
   :show-inheritance:

Templates
---------

PromptTemplate
~~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.PromptTemplate
   :members:
   :show-inheritance:

ClassificationTemplate
~~~~~~~~~~~~~~~~~~~~~~
.. autoclass:: phoenix.evals.ClassificationTemplate
   :members:
   :show-inheritance:

Utilities
---------

compute_precisions_at_k
~~~~~~~~~~~~~~~~~~~~~~~
.. autofunction:: phoenix.evals.compute_precisions_at_k

download_benchmark_dataset
~~~~~~~~~~~~~~~~~~~~~~~~~~
.. autofunction:: phoenix.evals.download_benchmark_dataset

Module Contents
---------------

.. automodule:: phoenix.evals
   :members:
   :exclude-members: llm_classify, llm_generate, run_evals, LLMEvaluator, HallucinationEvaluator, QAEvaluator, RelevanceEvaluator, ToxicityEvaluator, SummarizationEvaluator, SQLEvaluator, OpenAIModel, AnthropicModel, GeminiModel, GoogleGenAIModel, VertexAIModel, BedrockModel, LiteLLMModel, MistralAIModel, PromptTemplate, ClassificationTemplate, compute_precisions_at_k, download_benchmark_dataset
   :no-undoc-members: 