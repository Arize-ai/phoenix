/**
 * @generated SignedSource<<9afe84a02601a0ec736ef59ea3d5fd71>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AvailableAgentSkillsInput = {
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
    readonly userDescription: string;
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
        "name": "userDescription",
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
    "name": "useAvailableAgentSkillsQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useAvailableAgentSkillsQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "75e2499e4079bb2fe734acf609486ef6",
    "id": null,
    "metadata": {},
    "name": "useAvailableAgentSkillsQuery",
    "operationKind": "query",
    "text": "query useAvailableAgentSkillsQuery(\n  $input: AvailableAgentSkillsInput\n) {\n  availableAgentSkills(input: $input) {\n    name\n    description\n    userDescription\n  }\n}\n"
  }
};
})();

(node as any).hash = "187ece9990de6a5722900ac73a9b829a";

export default node;
