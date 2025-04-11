/**
 * @generated SignedSource<<19ac56bacfb13de653b1b6f11eba0372>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AnnotationConfigListAssociateAnnotationConfigWithProjectMutation$variables = {
  annotationConfigId: string;
  projectId: string;
};
export type AnnotationConfigListAssociateAnnotationConfigWithProjectMutation$data = {
  readonly addAnnotationConfigToProject: {
    readonly project: {
      readonly " $fragmentSpreads": FragmentRefs<"AnnotationConfigListProjectAnnotationConfigFragment">;
    };
  };
};
export type AnnotationConfigListAssociateAnnotationConfigWithProjectMutation = {
  response: AnnotationConfigListAssociateAnnotationConfigWithProjectMutation$data;
  variables: AnnotationConfigListAssociateAnnotationConfigWithProjectMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "annotationConfigId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v2 = [
  {
    "fields": [
      {
        "kind": "Variable",
        "name": "annotationConfigId",
        "variableName": "annotationConfigId"
      },
      {
        "kind": "Variable",
        "name": "projectId",
        "variableName": "projectId"
      }
    ],
    "kind": "ObjectValue",
    "name": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "AnnotationConfigListAssociateAnnotationConfigWithProjectMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "AddAnnotationConfigToProjectPayload",
        "kind": "LinkedField",
        "name": "addAnnotationConfigToProject",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Project",
            "kind": "LinkedField",
            "name": "project",
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
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "AnnotationConfigListAssociateAnnotationConfigWithProjectMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "AddAnnotationConfigToProjectPayload",
        "kind": "LinkedField",
        "name": "addAnnotationConfigToProject",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Project",
            "kind": "LinkedField",
            "name": "project",
            "plural": false,
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
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "__typename",
                            "storageKey": null
                          },
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
              },
              (v3/*: any*/)
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "f17fddf830bc9198d6d1ef9039384549",
    "id": null,
    "metadata": {},
    "name": "AnnotationConfigListAssociateAnnotationConfigWithProjectMutation",
    "operationKind": "mutation",
    "text": "mutation AnnotationConfigListAssociateAnnotationConfigWithProjectMutation(\n  $projectId: GlobalID!\n  $annotationConfigId: GlobalID!\n) {\n  addAnnotationConfigToProject(input: {projectId: $projectId, annotationConfigId: $annotationConfigId}) {\n    project {\n      ...AnnotationConfigListProjectAnnotationConfigFragment\n    }\n  }\n}\n\nfragment AnnotationConfigListProjectAnnotationConfigFragment on Project {\n  annotationConfigs {\n    edges {\n      node {\n        __typename\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n        ... on AnnotationConfigBase {\n          __isAnnotationConfigBase: __typename\n          name\n          annotationType\n        }\n      }\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "6a506c9a5da198c5d0a590979eabf230";

export default node;
