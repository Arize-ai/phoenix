inferences / schema
===================

.. contents:: :local:

phoenix.Inferences
------------------
.. autoclass:: inferences.inferences::Inferences
   :members:
   :exclude-members: to_disc, from_name, from_open_inference

phoenix.Schema
--------------
.. autoclass:: inferences.schema::Schema
   :no-undoc-members:
   :exclude-members: RetrievalEmbeddingColumnNames, to_json

phoenix.EmbeddingColumnNames
----------------------------
.. autoclass:: inferences.schema::EmbeddingColumnNames
   :no-undoc-members:
   :exclude-members: link_to_data_column_name, raw_data_column_name, vector_column_name

phoenix.TraceDataset
--------------------
.. autoclass:: trace.trace_dataset::TraceDataset
   :special-members: __init__
   :no-undoc-members:
   :exclude-members: append_evaluations, dataframe, evaluations, from_name, from_spans, load, save, to_spans, to_disc