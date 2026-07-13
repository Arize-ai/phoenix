/**
 * @generated SignedSource<<d426e0b19f98fb2e0608dd65f8c63620>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AddAnnotationConfigToProjectInput = {
  annotationConfigId: string;
  projectId: string;
};
export type createAnnotationConfigAssociateMutation$variables = {
  input: ReadonlyArray<AddAnnotationConfigToProjectInput>;
};
export type createAnnotationConfigAssociateMutation$data = {
  readonly addAnnotationConfigToProject: {
    readonly project: {
      readonly id: string;
    };
  };
};
export type createAnnotationConfigAssociateMutation = {
  response: createAnnotationConfigAssociateMutation$data;
  variables: createAnnotationConfigAssociateMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
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
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "createAnnotationConfigAssociateMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "createAnnotationConfigAssociateMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "0490e301d1f96ef54817b14b2393e872",
    "id": null,
    "metadata": {},
    "name": "createAnnotationConfigAssociateMutation",
    "operationKind": "mutation",
    "text": "mutation createAnnotationConfigAssociateMutation(\n  $input: [AddAnnotationConfigToProjectInput!]!\n) {\n  addAnnotationConfigToProject(input: $input) {\n    project {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "4dc788f087e40f72a9297ff4d0be6dc8";

export default node;
