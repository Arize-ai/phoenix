/**
 * @generated SignedSource<<3f931906387bd2a66823b370727199d1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type Language = "PYTHON" | "TYPESCRIPT";
import { FragmentRefs } from "relay-runtime";
export type CodeDatasetEvaluatorVersions_datasetEvaluator$data = {
  readonly evaluator: {
    readonly __typename: "CodeEvaluator";
    readonly id: string;
    readonly language: Language;
    readonly versions: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly createdAt: string;
          readonly id: string;
          readonly previousVersion: {
            readonly id: string;
            readonly sourceCode: string;
          } | null;
          readonly sequenceNumber: number;
          readonly sourceCode: string;
          readonly user: {
            readonly id: string;
            readonly profilePictureUrl: string | null;
            readonly username: string;
          } | null;
        };
      }>;
    };
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
  readonly " $fragmentType": "CodeDatasetEvaluatorVersions_datasetEvaluator";
};
export type CodeDatasetEvaluatorVersions_datasetEvaluator$key = {
  readonly " $data"?: CodeDatasetEvaluatorVersions_datasetEvaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"CodeDatasetEvaluatorVersions_datasetEvaluator">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sourceCode",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "CodeDatasetEvaluatorVersions_datasetEvaluator",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": null,
      "kind": "LinkedField",
      "name": "evaluator",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "__typename",
          "storageKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            (v0/*: any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "language",
              "storageKey": null
            },
            {
              "alias": null,
              "args": [
                {
                  "kind": "Literal",
                  "name": "first",
                  "value": 50
                }
              ],
              "concreteType": "CodeEvaluatorVersionConnection",
              "kind": "LinkedField",
              "name": "versions",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "CodeEvaluatorVersionEdge",
                  "kind": "LinkedField",
                  "name": "edges",
                  "plural": true,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "CodeEvaluatorVersion",
                      "kind": "LinkedField",
                      "name": "node",
                      "plural": false,
                      "selections": [
                        (v0/*: any*/),
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "sequenceNumber",
                          "storageKey": null
                        },
                        (v1/*: any*/),
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "createdAt",
                          "storageKey": null
                        },
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "User",
                          "kind": "LinkedField",
                          "name": "user",
                          "plural": false,
                          "selections": [
                            (v0/*: any*/),
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "username",
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "profilePictureUrl",
                              "storageKey": null
                            }
                          ],
                          "storageKey": null
                        },
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "CodeEvaluatorVersion",
                          "kind": "LinkedField",
                          "name": "previousVersion",
                          "plural": false,
                          "selections": [
                            (v0/*: any*/),
                            (v1/*: any*/)
                          ],
                          "storageKey": null
                        }
                      ],
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                }
              ],
              "storageKey": "versions(first:50)"
            }
          ],
          "type": "CodeEvaluator",
          "abstractKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "DatasetEvaluator",
  "abstractKey": null
};
})();

(node as any).hash = "b9f92e89efe87f3c731b00b97a3c6e3e";

export default node;
