/**
 * @generated SignedSource<<1c5bef42d6a1305fe1cd9bd434a24d6a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type useAvailableAgentSkillsQuery$variables = Record<PropertyKey, never>;
export type useAvailableAgentSkillsQuery$data = {
  readonly availableAgentSkills: ReadonlyArray<{
    readonly description: string;
    readonly name: string;
    readonly summary: string;
  }>;
};
export type useAvailableAgentSkillsQuery = {
  response: useAvailableAgentSkillsQuery$data;
  variables: useAvailableAgentSkillsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "AgentSkill",
    "kind": "LinkedField",
    "name": "availableAgentSkills",
    "plural": true,
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
        "name": "description",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "summary",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "useAvailableAgentSkillsQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "useAvailableAgentSkillsQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "a6d3389d16b285411064bbaf1a60a79e",
    "id": null,
    "metadata": {},
    "name": "useAvailableAgentSkillsQuery",
    "operationKind": "query",
    "text": "query useAvailableAgentSkillsQuery {\n  availableAgentSkills {\n    name\n    description\n    summary\n  }\n}\n"
  }
};
})();

(node as any).hash = "2127bddbd6e0f8ad434d1de9304c0321";

export default node;
