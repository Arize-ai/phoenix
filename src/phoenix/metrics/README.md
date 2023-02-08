# Phoenix Metrics

Phoenix leverages (pandas)[https://pandas.pydata.org/] and (numpy)[https://numpy.org/] to calculate MLOps critical metrics to measure model drift, performance, and data quality. All metrics can be measured as a single metric and as a time series metric.

## Time Series

Metrics provided by phoenix can be resolved over the time that the model inferences occurred. When a metric is resolved over time, the metric output is tunable using the following parameters:

-   `Time Range` - the start / end time of the data you want to analyze.
-   `Granularity` - the amount of time between the two data points. Defaults to `hour` granularity.
-   `Evaluation Window` - the duration of time with which each metric point gets calculated. For instance, a 30 day evaluation window would make every metric calculation be calculated using 30 days of data, even though the data points are spaced in 1 hour granularity. Use evaluation windows when you are trying to figure out larger trends in your metrics rather than local minimums and maximums). Evaluation windows make more data be used to calculate a single point, which typically results in less volatility.
-   `UTC Offset` - Not implemented
-   `Filters` - Not implemented

### Model Structured Drift Metrics

Model drift metrics track how much a given dimension (feature, tag, prediction, or actual) drifts from a specific reference dataset (sometimes referred to as a `baseline`)

#### No Data for drift

You can get a `no data` result for drift under a few circumstances:

-   The primary dataset contains no data
-   The reference dataset (baseline) contains no data

We gracefully handle both of these cases via TODO.

### Embedding Drift Metrics

Embedding drift captures the `distance` between the embedding vectors in the two datasets under examination. Because of this, the vectors in each dataset must match in size so that the vector distance can be calculated in the name `n`th dimension.
