import { PointsProps, ThreeDimensionalPoint } from "@arizeai/point-cloud";

export type ThreeDimensionalPointItem = {
  position: ThreeDimensionalPoint;
  metaData: unknown;
};

export type ClusterItem = {
  readonly id: string;
  readonly pointIds: readonly string[];
};

export enum ColoringStrategy {
  dataset = "dataset",
  correctness = "correctness",
}

export type PointColor = PointsProps["pointProps"]["color"];
