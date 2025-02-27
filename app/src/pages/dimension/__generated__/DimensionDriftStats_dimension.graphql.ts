/**
 * @generated SignedSource<<4813f1f2bdb4e9ac37e902abcc2c2485>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DimensionDriftStats_dimension$data = {
  readonly id: string;
  readonly psi: number | null;
  readonly " $fragmentType": "DimensionDriftStats_dimension";
};
export type DimensionDriftStats_dimension$key = {
  readonly " $data"?: DimensionDriftStats_dimension$data;
  readonly " $fragmentSpreads": FragmentRefs<"DimensionDriftStats_dimension">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "timeRange"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "DimensionDriftStats_dimension",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
    {
      "alias": "psi",
      "args": [
        {
          "kind": "Literal",
          "name": "metric",
          "value": "psi"
        },
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "timeRange"
        }
      ],
      "kind": "ScalarField",
      "name": "driftMetric",
      "storageKey": null
    }
  ],
  "type": "Dimension",
  "abstractKey": null
};

(node as any).hash = "f8a9fb08a14f63906e38bc247d50b189";

export default node;
