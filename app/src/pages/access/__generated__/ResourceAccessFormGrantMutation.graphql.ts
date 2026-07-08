/**
 * @generated SignedSource<<b686c1b60afc73f12d69d4b3a117e418>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AccessGrantInput = {
  object: AccessGrantObjectInput;
  permissionSetId?: string | null;
  subject: AccessGrantSubjectInput;
};
export type AccessGrantSubjectInput = {
  isEveryone?: boolean | null;
  userGroupId?: string | null;
  userId?: string | null;
};
export type AccessGrantObjectInput = {
  datasetId?: string | null;
  projectId?: string | null;
  promptId?: string | null;
};
export type ResourceAccessFormGrantMutation$variables = {
  input: AccessGrantInput;
};
export type ResourceAccessFormGrantMutation$data = {
  readonly grantAccess: {
    readonly __typename: "AccessGrantMutationPayload";
  };
};
export type ResourceAccessFormGrantMutation = {
  response: ResourceAccessFormGrantMutation$data;
  variables: ResourceAccessFormGrantMutation$variables;
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
    "concreteType": "AccessGrantMutationPayload",
    "kind": "LinkedField",
    "name": "grantAccess",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "__typename",
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
    "name": "ResourceAccessFormGrantMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ResourceAccessFormGrantMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "194a2ca9a6ad13cf41ec30f2753f6f80",
    "id": null,
    "metadata": {},
    "name": "ResourceAccessFormGrantMutation",
    "operationKind": "mutation",
    "text": "mutation ResourceAccessFormGrantMutation(\n  $input: AccessGrantInput!\n) {\n  grantAccess(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "a1b229182ea96a373c5f1ff4777009cf";

export default node;
