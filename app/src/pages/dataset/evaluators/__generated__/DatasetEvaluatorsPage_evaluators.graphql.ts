/**
 * @generated SignedSource<<5109eb24634bdaa2c5ae303082fee604>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EvaluatorKind = "CODE" | "LLM";
import { FragmentRefs } from "relay-runtime";
export type DatasetEvaluatorsPage_evaluators$data = {
  readonly evaluators: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly isAssignedToDataset: boolean;
        readonly kind: EvaluatorKind;
        readonly name: string;
      };
    }>;
  };
  readonly " $fragmentType": "DatasetEvaluatorsPage_evaluators";
};
export type DatasetEvaluatorsPage_evaluators$key = {
  readonly " $data"?: DatasetEvaluatorsPage_evaluators$data;
  readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorsPage_evaluators">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "datasetId"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "DatasetEvaluatorsPage_evaluators",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "first",
          "value": 100
        }
      ],
      "concreteType": "EvaluatorConnection",
      "kind": "LinkedField",
      "name": "evaluators",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "EvaluatorEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": null,
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "id",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "name",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "kind",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": [
                    {
                      "kind": "Variable",
                      "name": "datasetId",
                      "variableName": "datasetId"
                    }
                  ],
                  "kind": "ScalarField",
                  "name": "isAssignedToDataset",
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": "evaluators(first:100)"
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "36501967bdd54ddfa9a09f4f8421700c";

export default node;
