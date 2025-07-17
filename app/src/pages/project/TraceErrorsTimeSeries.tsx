import { useSemanticChartColors } from "@phoenix/components/chart";
import { TimeSeriesBarChart } from "@phoenix/components/chart/TimeSeriesBarChart";

const chartData = [
  {
    timestamp: "2021-01-01",
    error: 0,
  },
  {
    timestamp: "2021-01-02",
    error: 0,
  },
  {
    timestamp: "2021-01-03",
    error: 0,
  },
  {
    timestamp: "2021-01-04",
    error: 10,
  },
  {
    timestamp: "2021-01-05",
    error: 30,
  },
  {
    timestamp: "2021-01-06",
    error: 0,
  },
  {
    timestamp: "2021-01-07",
    error: 40,
  },
  {
    timestamp: "2021-01-08",
    error: 0,
  },
  {
    timestamp: "2021-01-09",
    error: 10,
  },
  {
    timestamp: "2021-01-10",
    error: 0,
  },
  {
    timestamp: "2021-01-11",
    error: 0,
  },
];

export function TraceErrorsTimeSeries() {
  const timeRange = {
    start: new Date("2021-01-01"),
    end: new Date("2021-01-11"),
  };
  const SemanticChartColors = useSemanticChartColors();
  return (
    <TimeSeriesBarChart
      data={chartData}
      colorMap={{
        error: SemanticChartColors.danger,
      }}
      orderedKeys={["error"]}
      timeRange={timeRange}
    />
  );
}
