/**
 * @generated SignedSource<<dfd03bef112ed30069b8063ab08bb352>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type AnnotationType = "CATEGORICAL" | "CONTINUOUS" | "FREEFORM";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type SessionAnnotationConfigListProjectAnnotationConfigFragment$data = {
  readonly annotationConfigs: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly annotationType?: AnnotationType;
        readonly description?: string | null;
        readonly id?: string;
        readonly lowerBound?: number | null;
        readonly name?: string;
        readonly optimizationDirection?: OptimizationDirection;
        readonly threshold?: number | null;
        readonly upperBound?: number | null;
        readonly values?: ReadonlyArray<{
          readonly label: string;
          readonly score: number | null;
        }>;
      };
    }>;
  };
  readonly " $fragmentType": "SessionAnnotationConfigListProjectAnnotationConfigFragment";
};
export type SessionAnnotationConfigListProjectAnnotationConfigFragment$key = {
  readonly " $data"?: SessionAnnotationConfigListProjectAnnotationConfigFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"SessionAnnotationConfigListProjectAnnotationConfigFragment">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "SessionAnnotationConfigListProjectAnnotationConfigFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "AnnotationConfigConnection",
      "kind": "LinkedField",
      "name": "annotationConfigs",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "AnnotationConfigEdge",
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
                  "kind": "InlineFragment",
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "id",
                      "storageKey": null
                    }
                  ],
                  "type": "Node",
                  "abstractKey": "__isNode"
                },
                {
                  "kind": "InlineFragment",
                  "selections": [
                    (v0/*: any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "annotationType",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "description",
                      "storageKey": null
                    }
                  ],
                  "type": "AnnotationConfigBase",
                  "abstractKey": "__isAnnotationConfigBase"
                },
                {
                  "kind": "InlineFragment",
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "CategoricalAnnotationValue",
                      "kind": "LinkedField",
                      "name": "values",
                      "plural": true,
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "label",
                          "storageKey": null
                        },
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "score",
                          "storageKey": null
                        }
                      ],
                      "storageKey": null
                    }
                  ],
                  "type": "CategoricalAnnotationConfig",
                  "abstractKey": null
                },
                {
                  "kind": "InlineFragment",
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "lowerBound",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "upperBound",
                      "storageKey": null
                    },
                    (v1/*: any*/)
                  ],
                  "type": "ContinuousAnnotationConfig",
                  "abstractKey": null
                },
                {
                  "kind": "InlineFragment",
                  "selections": [
                    (v0/*: any*/),
                    (v1/*: any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "threshold",
                      "storageKey": null
                    }
                  ],
                  "type": "FreeformAnnotationConfig",
                  "abstractKey": null
                }
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
  "type": "Project",
  "abstractKey": null
};
})();

(node as any).hash = "62e71fe22677fd48b5ae5017f9e55469";

export default node;
