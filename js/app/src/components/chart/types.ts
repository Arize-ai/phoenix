/**
 * How a chart draws a series of points: `lineTimeSeries` connects ordered
 * points (e.g. experiments over time), `barTimeSeries` draws each point as its
 * own bar, for points with no inherent order (e.g. compared experiments)
 */
export type TimeSeriesChartType = "barTimeSeries" | "lineTimeSeries";
