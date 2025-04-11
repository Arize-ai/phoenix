/**
 * @generated SignedSource<<df51053b038d33f30b0d0760a7534eff>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type AnnotationConfigListRemoveAnnotationConfigFromProjectMutation$variables = {
  annotationConfigId: string;
  projectId: string;
};
export type AnnotationConfigListRemoveAnnotationConfigFromProjectMutation$data = {
  readonly removeAnnotationConfigFromProject: {
    readonly project: {
      readonly " $fragmentSpreads": FragmentRefs<"AnnotationConfigListProjectAnnotationConfigFragment">;
    };
  };
};
export type AnnotationConfigListRemoveAnnotationConfigFromProjectMutation = {
  response: AnnotationConfigListRemoveAnnotationConfigFromProjectMutation$data;
  variables: AnnotationConfigListRemoveAnnotationConfigFromProjectMutation$variables;
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
    "name": "AnnotationConfigListRemoveAnnotationConfigFromProjectMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "RemoveAnnotationConfigFromProjectPayload",
        "kind": "LinkedField",
        "name": "removeAnnotationConfigFromProject",
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
    "name": "AnnotationConfigListRemoveAnnotationConfigFromProjectMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "RemoveAnnotationConfigFromProjectPayload",
        "kind": "LinkedField",
        "name": "removeAnnotationConfigFromProject",
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
    "cacheID": "2612e19a1b85e5df96eda9a65e8317b8",
    "id": null,
    "metadata": {},
    "name": "AnnotationConfigListRemoveAnnotationConfigFromProjectMutation",
    "operationKind": "mutation",
    "text": "mutation AnnotationConfigListRemoveAnnotationConfigFromProjectMutation(\n  $projectId: GlobalID!\n  $annotationConfigId: GlobalID!\n) {\n  removeAnnotationConfigFromProject(input: {projectId: $projectId, annotationConfigId: $annotationConfigId}) {\n    project {\n      ...AnnotationConfigListProjectAnnotationConfigFragment\n    }\n  }\n}\n\nfragment AnnotationConfigListProjectAnnotationConfigFragment on Project {\n  annotationConfigs {\n    edges {\n      node {\n        __typename\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n        ... on AnnotationConfigBase {\n          __isAnnotationConfigBase: __typename\n          name\n          annotationType\n        }\n      }\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "1b442d62354e4683685075a3d3873569";

export default node;
