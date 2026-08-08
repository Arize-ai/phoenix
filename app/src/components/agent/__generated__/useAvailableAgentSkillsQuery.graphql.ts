/**
 * @generated SignedSource<<edfcb8c95bd957d622d45ef38ddc4c78>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AvailableAgentSkillsInput = {
  hasCodeEvaluatorContext?: boolean;
  hasDatasetContext?: boolean;
  hasLlmEvaluatorContext?: boolean;
  hasPlaygroundContext?: boolean;
};
export type useAvailableAgentSkillsQuery$variables = {
  input?: AvailableAgentSkillsInput | null;
};
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useAvailableAgentSkillsQuery",
    "selections": (v1/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useAvailableAgentSkillsQuery",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "6d1ed961dcc6c90e21d4c60d4f31c6ef",
    "id": null,
    "metadata": {},
    "name": "useAvailableAgentSkillsQuery",
    "operationKind": "query",
    "text": "query useAvailableAgentSkillsQuery(\n  $input: AvailableAgentSkillsInput\n) {\n  availableAgentSkills(input: $input) {\n    name\n    description\n    summary\n  }\n}\n"
  }
};
})();

(node as any).hash = "7d46e246444b90376bb1599da8d2db2a";

export default node;
