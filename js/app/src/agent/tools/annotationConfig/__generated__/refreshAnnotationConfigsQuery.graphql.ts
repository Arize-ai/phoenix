/**
 * @generated SignedSource<<69832bf87b93429df97cb53d0859d7cd>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AnnotationType = "CATEGORICAL" | "CONTINUOUS" | "FREEFORM";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type refreshAnnotationConfigsQuery$variables = Record<PropertyKey, never>;
export type refreshAnnotationConfigsQuery$data = {
  readonly annotationConfigs: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly __typename: string;
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
  readonly " $fragmentSpreads": FragmentRefs<"AnnotationConfigTableFragment">;
};
export type refreshAnnotationConfigsQuery = {
  response: refreshAnnotationConfigsQuery$data;
  variables: refreshAnnotationConfigsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "kind": "InlineFragment",
  "selections": [
    (v1/*:: as any*/)
  ],
  "type": "Node",
  "abstractKey": "__isNode"
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotationType",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v7 = {
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
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "threshold",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "node",
  "plural": false,
  "selections": [
    (v0/*:: as any*/),
    (v2/*:: as any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        (v3/*:: as any*/),
        (v4/*:: as any*/),
        (v5/*:: as any*/)
      ],
      "type": "AnnotationConfigBase",
      "abstractKey": "__isAnnotationConfigBase"
    },
    {
      "kind": "InlineFragment",
      "selections": [
        (v6/*:: as any*/),
        (v7/*:: as any*/)
      ],
      "type": "CategoricalAnnotationConfig",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        (v6/*:: as any*/),
        (v8/*:: as any*/),
        (v9/*:: as any*/)
      ],
      "type": "ContinuousAnnotationConfig",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": [
        (v6/*:: as any*/),
        (v10/*:: as any*/)
      ],
      "type": "FreeformAnnotationConfig",
      "abstractKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "refreshAnnotationConfigsQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "AnnotationConfigTableFragment"
      },
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
              (v11/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "refreshAnnotationConfigsQuery",
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
                "alias": "annotationConfig",
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v0/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v1/*:: as any*/),
                      (v3/*:: as any*/),
                      (v4/*:: as any*/),
                      (v5/*:: as any*/),
                      (v6/*:: as any*/),
                      (v7/*:: as any*/)
                    ],
                    "type": "CategoricalAnnotationConfig",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v1/*:: as any*/),
                      (v3/*:: as any*/),
                      (v4/*:: as any*/),
                      (v5/*:: as any*/),
                      (v6/*:: as any*/),
                      (v9/*:: as any*/),
                      (v8/*:: as any*/)
                    ],
                    "type": "ContinuousAnnotationConfig",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v1/*:: as any*/),
                      (v3/*:: as any*/),
                      (v4/*:: as any*/),
                      (v5/*:: as any*/),
                      (v6/*:: as any*/),
                      (v10/*:: as any*/)
                    ],
                    "type": "FreeformAnnotationConfig",
                    "abstractKey": null
                  },
                  (v2/*:: as any*/)
                ],
                "storageKey": null
              },
              (v11/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "fcc9e9e16a5f41b2634206250bd03473",
    "id": null,
    "metadata": {},
    "name": "refreshAnnotationConfigsQuery",
    "operationKind": "query",
    "text": "query refreshAnnotationConfigsQuery {\n  ...AnnotationConfigTableFragment\n  annotationConfigs {\n    edges {\n      node {\n        __typename\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n        ... on AnnotationConfigBase {\n          __isAnnotationConfigBase: __typename\n          name\n          description\n          annotationType\n        }\n        ... on CategoricalAnnotationConfig {\n          optimizationDirection\n          values {\n            label\n            score\n          }\n        }\n        ... on ContinuousAnnotationConfig {\n          optimizationDirection\n          lowerBound\n          upperBound\n        }\n        ... on FreeformAnnotationConfig {\n          optimizationDirection\n          threshold\n        }\n      }\n    }\n  }\n}\n\nfragment AnnotationConfigTableFragment on Query {\n  annotationConfigs {\n    edges {\n      annotationConfig: node {\n        __typename\n        ... on CategoricalAnnotationConfig {\n          id\n          name\n          description\n          annotationType\n          optimizationDirection\n          values {\n            label\n            score\n          }\n        }\n        ... on ContinuousAnnotationConfig {\n          id\n          name\n          description\n          annotationType\n          optimizationDirection\n          upperBound\n          lowerBound\n        }\n        ... on FreeformAnnotationConfig {\n          id\n          name\n          description\n          annotationType\n          optimizationDirection\n          threshold\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "204122de852bf1c96df075cb2f32badb";

export default node;
