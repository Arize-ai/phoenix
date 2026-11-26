/**
 * @generated SignedSource<<e3ee0dc5cf9e68853290e81dfeb9beed>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type TagDecisionVersionButtonSetTagMutation$variables = {
  description?: string | null;
  name: string;
  versionId: string;
};
export type TagDecisionVersionButtonSetTagMutation$data = {
  readonly setDecisionVersionTag: {
    readonly decisionVersionTag: {
      readonly decisionVersionId: string;
      readonly description: string | null;
      readonly id: string;
      readonly name: string;
    } | null;
  };
};
export type TagDecisionVersionButtonSetTagMutation = {
  response: TagDecisionVersionButtonSetTagMutation$data;
  variables: TagDecisionVersionButtonSetTagMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "description"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "name"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "versionId"
},
v3 = [
  {
    "alias": null,
    "args": [
      {
        "fields": [
          {
            "kind": "Variable",
            "name": "decisionVersionId",
            "variableName": "versionId"
          },
          {
            "kind": "Variable",
            "name": "description",
            "variableName": "description"
          },
          {
            "kind": "Variable",
            "name": "name",
            "variableName": "name"
          }
        ],
        "kind": "ObjectValue",
        "name": "input"
      }
    ],
    "concreteType": "DecisionVersionTagMutationPayload",
    "kind": "LinkedField",
    "name": "setDecisionVersionTag",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DecisionVersionTag",
        "kind": "LinkedField",
        "name": "decisionVersionTag",
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
            "name": "name",
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
            "name": "decisionVersionId",
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
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "TagDecisionVersionButtonSetTagMutation",
    "selections": (v3/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*:: as any*/),
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "TagDecisionVersionButtonSetTagMutation",
    "selections": (v3/*:: as any*/)
  },
  "params": {
    "cacheID": "2405fb1d58b98dc20c60754a9d1a06c8",
    "id": null,
    "metadata": {},
    "name": "TagDecisionVersionButtonSetTagMutation",
    "operationKind": "mutation",
    "text": "mutation TagDecisionVersionButtonSetTagMutation(\n  $versionId: ID!\n  $name: Identifier!\n  $description: String\n) {\n  setDecisionVersionTag(input: {decisionVersionId: $versionId, name: $name, description: $description}) {\n    decisionVersionTag {\n      id\n      name\n      description\n      decisionVersionId\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "3d9160281944face3f2a6a96822a5f33";

export default node;
