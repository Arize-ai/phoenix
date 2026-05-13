export type ChartDatum = {
  label: string;
  value: number;
};

export type SeriesDatum = {
  label: string;
  values: ChartDatum[];
};
