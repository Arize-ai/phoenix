export type ChartDatum = {
  label: string;
  value: number;
};

export type VerticalBarDatum = ChartDatum & {
  highlight?: number | null;
};

export type StackedBarSegment = {
  label: string;
  value: number;
};

export type StackedBarDatum = {
  label: string;
  segments: StackedBarSegment[];
};

export type LineSeries = {
  label?: string | null;
  data: number[];
};
