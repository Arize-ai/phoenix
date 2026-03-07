/**
 * @generated SignedSource<<0b4ac99206045785ba3c2fe3cb52c776>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PatchProjectInput = {
  description?: string | null;
  gradientEndColor?: string | null;
  gradientStartColor?: string | null;
  id: string;
};
export type ProjectConfigPagePatchProjectMutation$variables = {
  input: PatchProjectInput;
};
export type ProjectConfigPagePatchProjectMutation$data = {
  readonly patchProject: {
    readonly project: {
      readonly description: string | null;
      readonly gradientEndColor: string;
      readonly gradientStartColor: string;
      readonly id: string;
    };
  };
};
export type ProjectConfigPagePatchProjectMutation = {
  response: ProjectConfigPagePatchProjectMutation$data;
  variables: ProjectConfigPagePatchProjectMutation$variables;
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
    "concreteType": "ProjectMutationPayload",
    "kind": "LinkedField",
    "name": "patchProject",
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
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "description",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "gradientStartColor",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "gradientEndColor",
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
    "name": "ProjectConfigPagePatchProjectMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ProjectConfigPagePatchProjectMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "467845668654b981ad74ed26e687b19c",
    "id": null,
    "metadata": {},
    "name": "ProjectConfigPagePatchProjectMutation",
    "operationKind": "mutation",
    "text": "mutation ProjectConfigPagePatchProjectMutation(\n  $input: PatchProjectInput!\n) {\n  patchProject(input: $input) {\n    project {\n      id\n      description\n      gradientStartColor\n      gradientEndColor\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "1c665373d905765df4bf4931107ef53c";

export default node;
