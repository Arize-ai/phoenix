/**
 * @generated SignedSource<<18922f931078ff8582ab1f7739de73cf>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SettingsAnnotationsPageFragmentQuery$variables = Record<PropertyKey, never>;
export type SettingsAnnotationsPageFragmentQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"SettingsAnnotationsPageFragment">;
};
export type SettingsAnnotationsPageFragmentQuery = {
  response: SettingsAnnotationsPageFragmentQuery$data;
  variables: SettingsAnnotationsPageFragmentQuery$variables;
};

const node: ConcreteRequest = (function(){
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
  "name": "name",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotationType",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "SettingsAnnotationsPageFragmentQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "SettingsAnnotationsPageFragment"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "SettingsAnnotationsPageFragmentQuery",
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
                      (v0/*:: as any*/),
                      (v1/*:: as any*/),
                      (v2/*:: as any*/),
                      (v3/*:: as any*/),
                      (v4/*:: as any*/),
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
                      (v0/*:: as any*/),
                      (v1/*:: as any*/),
                      (v2/*:: as any*/),
                      (v3/*:: as any*/),
                      (v4/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "upperBound",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "lowerBound",
                        "storageKey": null
                      }
                    ],
                    "type": "ContinuousAnnotationConfig",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v0/*:: as any*/),
                      (v1/*:: as any*/),
                      (v2/*:: as any*/),
                      (v3/*:: as any*/),
                      (v4/*:: as any*/),
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
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v0/*:: as any*/)
                    ],
                    "type": "Node",
                    "abstractKey": "__isNode"
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
    ]
  },
  "params": {
    "cacheID": "0a86aa80fee4cfabe46f0f363d151413",
    "id": null,
    "metadata": {},
    "name": "SettingsAnnotationsPageFragmentQuery",
    "operationKind": "query",
    "text": "query SettingsAnnotationsPageFragmentQuery {\n  ...SettingsAnnotationsPageFragment\n}\n\nfragment AnnotationConfigTableFragment on Query {\n  annotationConfigs {\n    edges {\n      annotationConfig: node {\n        __typename\n        ... on CategoricalAnnotationConfig {\n          id\n          name\n          description\n          annotationType\n          optimizationDirection\n          values {\n            label\n            score\n          }\n        }\n        ... on ContinuousAnnotationConfig {\n          id\n          name\n          description\n          annotationType\n          optimizationDirection\n          upperBound\n          lowerBound\n        }\n        ... on FreeformAnnotationConfig {\n          id\n          name\n          description\n          annotationType\n          optimizationDirection\n          threshold\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n  }\n}\n\nfragment SettingsAnnotationsPageFragment on Query {\n  ...AnnotationConfigTableFragment\n}\n"
  }
};
})();

(node as any).hash = "1108c006f0bdef6068549534988a5206";

export default node;
