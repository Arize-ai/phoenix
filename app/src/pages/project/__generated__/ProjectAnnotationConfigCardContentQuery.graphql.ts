/**
 * @generated SignedSource<<bec6b06f8ed044a3478385549e6647fc>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AnnotationType = "CATEGORICAL" | "CONTINUOUS" | "FREEFORM";
export type ProjectAnnotationConfigCardContentQuery$variables = {
  projectId: string;
};
export type ProjectAnnotationConfigCardContentQuery$data = {
  readonly allAnnotationConfigs: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly annotationType?: AnnotationType;
        readonly id?: string;
        readonly name?: string;
      };
    }>;
  };
  readonly project: {
    readonly " $fragmentSpreads": FragmentRefs<"ProjectAnnotationConfigCardContent_project_annotations">;
  };
};
export type ProjectAnnotationConfigCardContentQuery = {
  response: ProjectAnnotationConfigCardContentQuery$data;
  variables: ProjectAnnotationConfigCardContentQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "kind": "InlineFragment",
  "selections": [
    (v2/*: any*/)
  ],
  "type": "Node",
  "abstractKey": "__isNode"
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "kind": "InlineFragment",
  "selections": [
    (v4/*: any*/),
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
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectAnnotationConfigCardContentQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "ProjectAnnotationConfigCardContent_project_annotations"
              }
            ],
            "type": "Project",
            "abstractKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": "allAnnotationConfigs",
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
                  (v3/*: any*/),
                  (v5/*: any*/)
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
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ProjectAnnotationConfigCardContentQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v6/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v2/*: any*/),
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
                              (v4/*: any*/)
                            ],
                            "type": "AnnotationConfigBase",
                            "abstractKey": "__isAnnotationConfigBase"
                          },
                          (v3/*: any*/)
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
      },
      {
        "alias": "allAnnotationConfigs",
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
                  (v3/*: any*/),
                  (v5/*: any*/)
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
    "cacheID": "0c6ef22f77939481932f07f0e45a3154",
    "id": null,
    "metadata": {},
    "name": "ProjectAnnotationConfigCardContentQuery",
    "operationKind": "query",
    "text": "query ProjectAnnotationConfigCardContentQuery(\n  $projectId: GlobalID!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      ...ProjectAnnotationConfigCardContent_project_annotations\n    }\n    __isNode: __typename\n    id\n  }\n  allAnnotationConfigs: annotationConfigs {\n    edges {\n      node {\n        __typename\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n        ... on AnnotationConfigBase {\n          __isAnnotationConfigBase: __typename\n          name\n          annotationType\n        }\n      }\n    }\n  }\n}\n\nfragment ProjectAnnotationConfigCardContent_project_annotations on Project {\n  annotationConfigs {\n    edges {\n      node {\n        __typename\n        ... on AnnotationConfigBase {\n          __isAnnotationConfigBase: __typename\n          name\n        }\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "ed210ab30e8d40d669d27c7f83ada5b8";

export default node;
