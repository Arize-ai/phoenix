/**
 * @generated SignedSource<<8ead34cf61c9ea8b57082052bcaaa95d>>
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
  readonly globalEvaluators: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly isAssignedToDataset: boolean;
        readonly kind: EvaluatorKind;
        readonly name: string;
        readonly outputConfig?: {
          readonly name: string;
        };
      };
    }>;
  };
  readonly " $fragmentType": "DatasetEvaluatorsPage_evaluators";
};
export type DatasetEvaluatorsPage_evaluators$key = {
  readonly " $data"?: DatasetEvaluatorsPage_evaluators$data;
  readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorsPage_evaluators">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
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
      "alias": "globalEvaluators",
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
                (v0/*: any*/),
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
                },
                {
                  "kind": "InlineFragment",
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "CategoricalAnnotationConfig",
                      "kind": "LinkedField",
                      "name": "outputConfig",
                      "plural": false,
                      "selections": [
                        (v0/*: any*/)
                      ],
                      "storageKey": null
                    }
                  ],
                  "type": "LLMEvaluator",
                  "abstractKey": null
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
})();

(node as any).hash = "c8c555e1032017d5ac3931c429b6af36";

export default node;
