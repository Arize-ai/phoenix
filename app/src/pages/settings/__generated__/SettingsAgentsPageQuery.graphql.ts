/**
 * @generated SignedSource<<faee4505431ded7b7385aa0fb5082e43>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SettingsAgentsPageQuery$variables = Record<PropertyKey, never>;
export type SettingsAgentsPageQuery$data = {
  readonly agentsConfig: {
    readonly assistantProjectName: string;
    readonly collectorEndpoint: string | null;
  };
};
export type SettingsAgentsPageQuery = {
  response: SettingsAgentsPageQuery$data;
  variables: SettingsAgentsPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "AgentsConfig",
    "kind": "LinkedField",
    "name": "agentsConfig",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "collectorEndpoint",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "assistantProjectName",
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
    "name": "SettingsAgentsPageQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "SettingsAgentsPageQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "df131de67f0c140434276cfbaba53867",
    "id": null,
    "metadata": {},
    "name": "SettingsAgentsPageQuery",
    "operationKind": "query",
    "text": "query SettingsAgentsPageQuery {\n  agentsConfig {\n    collectorEndpoint\n    assistantProjectName\n  }\n}\n"
  }
};
})();

(node as any).hash = "695271dccb50b3b7fe2ebcff0c43e1da";

export default node;
