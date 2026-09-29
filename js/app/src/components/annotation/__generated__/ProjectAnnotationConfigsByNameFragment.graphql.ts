/**
 * @generated SignedSource<<db7207bf8000a92e2288a501328fc95b>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectAnnotationConfigsByNameFragment$data = {
  readonly annotationConfigs: {
    readonly edges: ReadonlyArray<{
      readonly config: {
        readonly " $fragmentSpreads": FragmentRefs<"useProjectAnnotationConfigsByName_config">;
      };
    }>;
  };
  readonly evaluators: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly evaluator: {
          readonly outputConfigs: ReadonlyArray<{
            readonly " $fragmentSpreads": FragmentRefs<"useProjectAnnotationConfigsByName_config">;
          }>;
        };
        readonly name: string;
      };
    }>;
  };
  readonly " $fragmentType": "ProjectAnnotationConfigsByNameFragment";
};
export type ProjectAnnotationConfigsByNameFragment$key = {
  readonly " $data"?: ProjectAnnotationConfigsByNameFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectAnnotationConfigsByNameFragment">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "kind": "Variable",
  "name": "first",
  "variableName": "first"
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v5 = [
  {
    "kind": "InlineDataFragmentSpread",
    "name": "useProjectAnnotationConfigsByName_config",
    "selections": [
      {
        "kind": "InlineFragment",
        "selections": [
          (v1/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "annotationType",
            "storageKey": null
          },
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*:: as any*/),
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
              (v2/*:: as any*/),
              (v3/*:: as any*/),
              (v4/*:: as any*/)
            ],
            "type": "ContinuousAnnotationConfig",
            "abstractKey": null
          },
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "threshold",
                "storageKey": null
              },
              (v3/*:: as any*/),
              (v4/*:: as any*/)
            ],
            "type": "FreeformAnnotationConfig",
            "abstractKey": null
          }
        ],
        "type": "AnnotationConfigBase",
        "abstractKey": "__isAnnotationConfigBase"
      }
    ],
    "args": null,
    "argumentDefinitions": ([]/*:: as any*/)
  }
];
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "annotationConfigNames"
    },
    {
      "defaultValue": 100,
      "kind": "LocalArgument",
      "name": "first"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectAnnotationConfigsByNameFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "fields": [
            {
              "kind": "Variable",
              "name": "annotationNames",
              "variableName": "annotationConfigNames"
            }
          ],
          "kind": "ObjectValue",
          "name": "filter"
        },
        (v0/*:: as any*/)
      ],
      "concreteType": "ProjectEvaluatorConnection",
      "kind": "LinkedField",
      "name": "evaluators",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "ProjectEvaluatorEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "ProjectEvaluator",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v1/*:: as any*/),
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
                      "concreteType": null,
                      "kind": "LinkedField",
                      "name": "outputConfigs",
                      "plural": true,
                      "selections": (v5/*:: as any*/),
                      "storageKey": null
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
      "storageKey": null
    },
    {
      "alias": null,
      "args": [
        (v0/*:: as any*/),
        {
          "kind": "Variable",
          "name": "names",
          "variableName": "annotationConfigNames"
        }
      ],
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
              "alias": "config",
              "args": null,
              "concreteType": null,
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": (v5/*:: as any*/),
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

(node as any).hash = "7e7bbfe9d3cce51af7b79ce5b7a2c436";

export default node;
