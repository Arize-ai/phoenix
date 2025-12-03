/**
 * @generated SignedSource<<9e6e964d44b42eeccf79baccf3d0b3a0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PlaygroundDatasetSection_evaluators$data = {
  readonly evaluators: {
    readonly edges: ReadonlyArray<{
      readonly evaluator: {
        readonly datasetInputMapping: {
          readonly literalMapping: any;
          readonly pathMapping: any;
        } | null;
        readonly id: string;
        readonly name: string;
        readonly outputConfig?: {
          readonly name: string;
        };
      };
    }>;
  };
  readonly " $fragmentType": "PlaygroundDatasetSection_evaluators";
};
export type PlaygroundDatasetSection_evaluators$key = {
  readonly " $data"?: PlaygroundDatasetSection_evaluators$data;
  readonly " $fragmentSpreads": FragmentRefs<"PlaygroundDatasetSection_evaluators">;
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
  "name": "PlaygroundDatasetSection_evaluators",
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
              "alias": "evaluator",
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
                  "args": [
                    {
                      "kind": "Variable",
                      "name": "datasetId",
                      "variableName": "datasetId"
                    }
                  ],
                  "concreteType": "EvaluatorInputMapping",
                  "kind": "LinkedField",
                  "name": "datasetInputMapping",
                  "plural": false,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "literalMapping",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "pathMapping",
                      "storageKey": null
                    }
                  ],
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
  "type": "Dataset",
  "abstractKey": null
};
})();

(node as any).hash = "180e5957d6d3047317a938c8fad1c610";

export default node;
