/**
 * @generated SignedSource<<10eb585dad8c62eaf22103c8e7ccbb30>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type AnnotationSummaryValueQuery$variables = {
  annotationName: string;
  filterCondition?: string | null;
  id: string;
  timeRange: TimeRange;
};
export type AnnotationSummaryValueQuery$data = {
  readonly node: {
    readonly " $fragmentSpreads": FragmentRefs<"AnnotationSummaryValueFragment">;
  };
};
export type AnnotationSummaryValueQuery = {
  response: AnnotationSummaryValueQuery$data;
  variables: AnnotationSummaryValueQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "annotationName"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filterCondition"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v5 = [
  {
    "kind": "Variable",
    "name": "annotationName",
    "variableName": "annotationName"
  },
  {
    "kind": "Variable",
    "name": "filterCondition",
    "variableName": "filterCondition"
  },
  {
    "kind": "Variable",
    "name": "timeRange",
    "variableName": "timeRange"
  }
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotationType",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/),
      (v3/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "AnnotationSummaryValueQuery",
    "selections": [
      {
        "alias": null,
        "args": (v4/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": (v5/*: any*/),
            "kind": "FragmentSpread",
            "name": "AnnotationSummaryValueFragment"
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
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v3/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Operation",
    "name": "AnnotationSummaryValueQuery",
    "selections": [
      {
        "alias": null,
        "args": (v4/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v6/*: any*/),
          (v7/*: any*/),
          {
            "kind": "InlineFragment",
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
                          (v6/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v8/*: any*/)
                            ],
                            "type": "AnnotationConfigBase",
                            "abstractKey": "__isAnnotationConfigBase"
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v8/*: any*/),
                              (v7/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "optimizationDirection",
                                "storageKey": null
                              },
                              (v9/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "CategoricalAnnotationValue",
                                "kind": "LinkedField",
                                "name": "values",
                                "plural": true,
                                "selections": [
                                  (v10/*: any*/),
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
                              (v7/*: any*/)
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
              },
              {
                "alias": null,
                "args": (v5/*: any*/),
                "concreteType": "AnnotationSummary",
                "kind": "LinkedField",
                "name": "spanAnnotationSummary",
                "plural": false,
                "selections": [
                  (v9/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "LabelFraction",
                    "kind": "LinkedField",
                    "name": "labelFractions",
                    "plural": true,
                    "selections": [
                      (v10/*: any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "fraction",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "meanScore",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Project",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "03fffbbd0caa295be23ae974ccfa704d",
    "id": null,
    "metadata": {},
    "name": "AnnotationSummaryValueQuery",
    "operationKind": "query",
    "text": "query AnnotationSummaryValueQuery(\n  $annotationName: String!\n  $filterCondition: String = null\n  $timeRange: TimeRange!\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...AnnotationSummaryValueFragment_3esv1j\n    id\n  }\n}\n\nfragment AnnotationSummaryValueFragment_3esv1j on Project {\n  annotationConfigs {\n    edges {\n      node {\n        __typename\n        ... on AnnotationConfigBase {\n          __isAnnotationConfigBase: __typename\n          annotationType\n        }\n        ... on CategoricalAnnotationConfig {\n          annotationType\n          id\n          optimizationDirection\n          name\n          values {\n            label\n            score\n          }\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n  }\n  spanAnnotationSummary(annotationName: $annotationName, timeRange: $timeRange, filterCondition: $filterCondition) {\n    name\n    labelFractions {\n      label\n      fraction\n    }\n    meanScore\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "aa59ac59f1e8626db047b2e546df43f4";

export default node;
