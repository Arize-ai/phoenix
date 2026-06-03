/**
 * @generated SignedSource<<872640e2f524d44e21b4b4b75e26018b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AnnotationConfigSlideoverAddToProjectMutation$variables = {
  annotationConfigId: string;
  projectId: string;
};
export type AnnotationConfigSlideoverAddToProjectMutation$data = {
  readonly addAnnotationConfigToProject: {
    readonly query: {
      readonly node: {
        readonly id?: string;
      };
    };
  };
};
export type AnnotationConfigSlideoverAddToProjectMutation = {
  response: AnnotationConfigSlideoverAddToProjectMutation$data;
  variables: AnnotationConfigSlideoverAddToProjectMutation$variables;
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
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v4 = {
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
    "name": "AnnotationConfigSlideoverAddToProjectMutation",
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
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": (v3/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v4/*: any*/)
                    ],
                    "type": "Project",
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
    "name": "AnnotationConfigSlideoverAddToProjectMutation",
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
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": (v3/*: any*/),
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
                  (v4/*: any*/)
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
    "cacheID": "9e7980d628fb47e6fed603fa3232b5eb",
    "id": null,
    "metadata": {},
    "name": "AnnotationConfigSlideoverAddToProjectMutation",
    "operationKind": "mutation",
    "text": "mutation AnnotationConfigSlideoverAddToProjectMutation(\n  $projectId: ID!\n  $annotationConfigId: ID!\n) {\n  addAnnotationConfigToProject(input: {projectId: $projectId, annotationConfigId: $annotationConfigId}) {\n    query {\n      node(id: $projectId) {\n        __typename\n        ... on Project {\n          id\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "d489848d0a77497d7e40ed0769755f33";

export default node;
