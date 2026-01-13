/**
 * @generated SignedSource<<7f7e6d6732b9d9dca87a19eda0093713>>
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
export type SpanAnnotationsEditor_projectAnnotationConfigs$data = {
  readonly annotationConfigs: {
    readonly configs: ReadonlyArray<{
      readonly config: {
        readonly __typename: string;
        readonly annotationType?: AnnotationType;
        readonly description?: string | null;
        readonly id?: string;
        readonly lowerBound?: number | null;
        readonly name?: string;
        readonly optimizationDirection?: OptimizationDirection;
        readonly upperBound?: number | null;
        readonly values?: ReadonlyArray<{
          readonly label: string;
          readonly score: number | null;
        }>;
      };
    }>;
  };
  readonly " $fragmentType": "SpanAnnotationsEditor_projectAnnotationConfigs";
};
export type SpanAnnotationsEditor_projectAnnotationConfigs$key = {
  readonly " $data"?: SpanAnnotationsEditor_projectAnnotationConfigs$data;
  readonly " $fragmentSpreads": FragmentRefs<"SpanAnnotationsEditor_projectAnnotationConfigs">;
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
  "name": "SpanAnnotationsEditor_projectAnnotationConfigs",
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
          "alias": "configs",
          "args": null,
          "concreteType": "AnnotationConfigEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "config",
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
                  "name": "__typename",
                  "storageKey": null
                },
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
                    (v1/*: any*/),
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
                    (v0/*: any*/)
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

(node as any).hash = "cf98a31da04de841697cf09b8e742e73";

export default node;
