import { PointsProps, ThreeDimensionalPoint } from "@arizeai/point-cloud";

export interface PontMetaData {
  id: string;
  predictionLabel?: string | null;
  actualLabel?: string | null;
  predictionScore?: number | null;
  actualScore?: number | null;
}
export type ThreeDimensionalPointItem = {
  position: ThreeDimensionalPoint;
  metaData: PontMetaData;
};

export type ClusterItem = {
  readonly id: string;
  readonly pointIds: readonly string[];
};

export type PointColor = PointsProps["pointProps"]["color"];
