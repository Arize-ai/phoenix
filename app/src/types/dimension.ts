export type Dimension = {
  id: string;
  name: string;
  type: "feature" | "tag" | "actual" | "prediction";
  dataType: "categorical" | "numeric";
};
