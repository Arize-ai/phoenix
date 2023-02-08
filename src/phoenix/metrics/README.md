# Phoenix Metrics

Phoenix leverages (pandas)[https://pandas.pydata.org/] and (numpy)[https://numpy.org/] to calculate MLOps critical metrics to measure model drift, performance, and data quality. All metrics can be measured as a single metric and as a time series metric.

## Time Series

Metrics provided by phoenix can be resolved over the time that the model inferences occurred. When a metric is resolved over time, the metric output is tunable using the following parameters:

-   `Time Range` - the start / end time of the data you want to analyze.
-   `Granularity` - the amount of time between the two data points. Defaults to `hour` granularity.
-   `Evaluation Window` - the duration of time with which each metric point gets calculated. For instance, a 30 day evaluation window would make every metric calculation be calculated using 30 days of data, even though the data points are spaced in 1 hour granularity. Use evaluation windows when you are trying to figure out larger trends in your metrics rather than local minimums and maximums). Evaluation windows make more data be used to calculate a single point, which typically results in less volatility.
