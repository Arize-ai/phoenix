/**
 * @generated SignedSource<<de575a2d49afc06bcdaf676fb9a93e27>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AnnotationConfigTableTestQuery$variables = Record<PropertyKey, never>;
export type AnnotationConfigTableTestQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"AnnotationConfigTableFragment">;
};
export type AnnotationConfigTableTestQuery = {
  response: AnnotationConfigTableTestQuery$data;
  variables: AnnotationConfigTableTestQuery$variables;
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
},
v5 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "String"
},
v6 = {
  "enumValues": null,
  "nullable": true,
  "plural": false,
  "type": "Float"
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "AnnotationConfigTableTestQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "AnnotationConfigTableFragment"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "AnnotationConfigTableTestQuery",
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
    "cacheID": "ca4387657824a1f4b7118a6f685704e7",
    "id": null,
    "metadata": {
      "relayTestingSelectionTypeInfo": {
        "annotationConfigs": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "AnnotationConfigConnection"
        },
        "annotationConfigs.edges": {
          "enumValues": null,
          "nullable": false,
          "plural": true,
          "type": "AnnotationConfigEdge"
        },
        "annotationConfigs.edges.annotationConfig": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "AnnotationConfig"
        },
        "annotationConfigs.edges.annotationConfig.__isNode": (v5/*:: as any*/),
        "annotationConfigs.edges.annotationConfig.__typename": (v5/*:: as any*/),
        "annotationConfigs.edges.annotationConfig.annotationType": {
          "enumValues": [
            "CATEGORICAL",
            "CONTINUOUS",
            "FREEFORM"
          ],
          "nullable": false,
          "plural": false,
          "type": "AnnotationType"
        },
        "annotationConfigs.edges.annotationConfig.description": {
          "enumValues": null,
          "nullable": true,
          "plural": false,
          "type": "String"
        },
        "annotationConfigs.edges.annotationConfig.id": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "ID"
        },
        "annotationConfigs.edges.annotationConfig.lowerBound": (v6/*:: as any*/),
        "annotationConfigs.edges.annotationConfig.name": (v5/*:: as any*/),
        "annotationConfigs.edges.annotationConfig.optimizationDirection": {
          "enumValues": [
            "MINIMIZE",
            "MAXIMIZE",
            "NONE"
          ],
          "nullable": false,
          "plural": false,
          "type": "OptimizationDirection"
        },
        "annotationConfigs.edges.annotationConfig.threshold": (v6/*:: as any*/),
        "annotationConfigs.edges.annotationConfig.upperBound": (v6/*:: as any*/),
        "annotationConfigs.edges.annotationConfig.values": {
          "enumValues": null,
          "nullable": false,
          "plural": true,
          "type": "CategoricalAnnotationValue"
        },
        "annotationConfigs.edges.annotationConfig.values.label": (v5/*:: as any*/),
        "annotationConfigs.edges.annotationConfig.values.score": (v6/*:: as any*/)
      }
    },
    "name": "AnnotationConfigTableTestQuery",
    "operationKind": "query",
    "text": "query AnnotationConfigTableTestQuery {\n  ...AnnotationConfigTableFragment\n}\n\nfragment AnnotationConfigTableFragment on Query {\n  annotationConfigs {\n    edges {\n      annotationConfig: node {\n        __typename\n        ... on CategoricalAnnotationConfig {\n          id\n          name\n          description\n          annotationType\n          optimizationDirection\n          values {\n            label\n            score\n          }\n        }\n        ... on ContinuousAnnotationConfig {\n          id\n          name\n          description\n          annotationType\n          optimizationDirection\n          upperBound\n          lowerBound\n        }\n        ... on FreeformAnnotationConfig {\n          id\n          name\n          description\n          annotationType\n          optimizationDirection\n          threshold\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "58ac3fad81fbb15e48536ef395b683de";

export default node;
