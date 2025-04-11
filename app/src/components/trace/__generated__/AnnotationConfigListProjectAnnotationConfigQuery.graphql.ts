/**
 * @generated SignedSource<<40cba0e1ddeee8fb5e595daa9c7b15e0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AnnotationConfigListProjectAnnotationConfigQuery$variables = {
  id: string;
};
export type AnnotationConfigListProjectAnnotationConfigQuery$data = {
  readonly node: {
    readonly " $fragmentSpreads": FragmentRefs<"AnnotationConfigListProjectAnnotationConfigFragment">;
  };
};
export type AnnotationConfigListProjectAnnotationConfigQuery = {
  response: AnnotationConfigListProjectAnnotationConfigQuery$data;
  variables: AnnotationConfigListProjectAnnotationConfigQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "AnnotationConfigListProjectAnnotationConfigQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "AnnotationConfigListProjectAnnotationConfigFragment"
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "AnnotationConfigListProjectAnnotationConfigQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v3/*: any*/),
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
                          (v2/*: any*/),
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              (v3/*: any*/)
                            ],
                            "type": "Node",
                            "abstractKey": "__isNode"
                          },
                          {
                            "kind": "InlineFragment",
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "name",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "annotationType",
                                "storageKey": null
                              }
                            ],
                            "type": "AnnotationConfigBase",
                            "abstractKey": "__isAnnotationConfigBase"
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
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "d1c4b5565d190b1a42cde94f82b8b06d",
    "id": null,
    "metadata": {},
    "name": "AnnotationConfigListProjectAnnotationConfigQuery",
    "operationKind": "query",
    "text": "query AnnotationConfigListProjectAnnotationConfigQuery(\n  $id: GlobalID!\n) {\n  node(id: $id) {\n    __typename\n    ...AnnotationConfigListProjectAnnotationConfigFragment\n    __isNode: __typename\n    id\n  }\n}\n\nfragment AnnotationConfigListProjectAnnotationConfigFragment on Project {\n  annotationConfigs {\n    edges {\n      node {\n        __typename\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n        ... on AnnotationConfigBase {\n          __isAnnotationConfigBase: __typename\n          name\n          annotationType\n        }\n      }\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "5a695ec16a3d4cc32260b23113d71674";

export default node;
