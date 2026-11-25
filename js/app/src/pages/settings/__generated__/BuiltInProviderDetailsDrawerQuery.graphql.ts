/**
 * @generated SignedSource<<5b7a09eb02034c481067ab8517849e40>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type ModelType = "CHAT" | "DECISION";
export type BuiltInProviderDetailsDrawerQuery$variables = {
  providerKey: GenerativeProviderKey;
};
export type BuiltInProviderDetailsDrawerQuery$data = {
  readonly chatModels: ReadonlyArray<{
    readonly name: string;
  }>;
  readonly decisionModels: ReadonlyArray<{
    readonly name: string;
  }>;
  readonly modelProviders: ReadonlyArray<{
    readonly chatDependencies: ReadonlyArray<string>;
    readonly chatDependenciesInstalled: boolean;
    readonly credentialRequirements: ReadonlyArray<{
      readonly envVarName: string;
      readonly isRequired: boolean;
    }>;
    readonly credentialsSet: boolean;
    readonly decisionDependencies: ReadonlyArray<string>;
    readonly decisionDependenciesInstalled: boolean;
    readonly key: GenerativeProviderKey;
    readonly modelTypes: ReadonlyArray<ModelType>;
    readonly name: string;
  }>;
};
export type BuiltInProviderDetailsDrawerQuery = {
  response: BuiltInProviderDetailsDrawerQuery$data;
  variables: BuiltInProviderDetailsDrawerQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "providerKey"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v2 = {
  "kind": "Literal",
  "name": "modelType",
  "value": "CHAT"
},
v3 = [
  (v2/*:: as any*/)
],
v4 = {
  "kind": "Literal",
  "name": "modelType",
  "value": "DECISION"
},
v5 = [
  (v4/*:: as any*/)
],
v6 = {
  "kind": "Variable",
  "name": "providerKey",
  "variableName": "providerKey"
},
v7 = [
  (v1/*:: as any*/)
],
v8 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "GenerativeProvider",
    "kind": "LinkedField",
    "name": "modelProviders",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "key",
        "storageKey": null
      },
      (v1/*:: as any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "modelTypes",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "credentialsSet",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "GenerativeProviderCredentialConfig",
        "kind": "LinkedField",
        "name": "credentialRequirements",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "envVarName",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "isRequired",
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": "chatDependencies",
        "args": (v3/*:: as any*/),
        "kind": "ScalarField",
        "name": "dependencies",
        "storageKey": "dependencies(modelType:\"CHAT\")"
      },
      {
        "alias": "chatDependenciesInstalled",
        "args": (v3/*:: as any*/),
        "kind": "ScalarField",
        "name": "dependenciesInstalled",
        "storageKey": "dependenciesInstalled(modelType:\"CHAT\")"
      },
      {
        "alias": "decisionDependencies",
        "args": (v5/*:: as any*/),
        "kind": "ScalarField",
        "name": "dependencies",
        "storageKey": "dependencies(modelType:\"DECISION\")"
      },
      {
        "alias": "decisionDependenciesInstalled",
        "args": (v5/*:: as any*/),
        "kind": "ScalarField",
        "name": "dependenciesInstalled",
        "storageKey": "dependenciesInstalled(modelType:\"DECISION\")"
      }
    ],
    "storageKey": null
  },
  {
    "alias": "chatModels",
    "args": [
      {
        "fields": [
          (v2/*:: as any*/),
          (v6/*:: as any*/)
        ],
        "kind": "ObjectValue",
        "name": "input"
      }
    ],
    "concreteType": "PlaygroundModel",
    "kind": "LinkedField",
    "name": "playgroundModels",
    "plural": true,
    "selections": (v7/*:: as any*/),
    "storageKey": null
  },
  {
    "alias": "decisionModels",
    "args": [
      {
        "fields": [
          (v4/*:: as any*/),
          (v6/*:: as any*/)
        ],
        "kind": "ObjectValue",
        "name": "input"
      }
    ],
    "concreteType": "PlaygroundModel",
    "kind": "LinkedField",
    "name": "playgroundModels",
    "plural": true,
    "selections": (v7/*:: as any*/),
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "BuiltInProviderDetailsDrawerQuery",
    "selections": (v8/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "BuiltInProviderDetailsDrawerQuery",
    "selections": (v8/*:: as any*/)
  },
  "params": {
    "cacheID": "a3c54ed57acfaa31102861d7c01432f3",
    "id": null,
    "metadata": {},
    "name": "BuiltInProviderDetailsDrawerQuery",
    "operationKind": "query",
    "text": "query BuiltInProviderDetailsDrawerQuery(\n  $providerKey: GenerativeProviderKey!\n) {\n  modelProviders {\n    key\n    name\n    modelTypes\n    credentialsSet\n    credentialRequirements {\n      envVarName\n      isRequired\n    }\n    chatDependencies: dependencies(modelType: CHAT)\n    chatDependenciesInstalled: dependenciesInstalled(modelType: CHAT)\n    decisionDependencies: dependencies(modelType: DECISION)\n    decisionDependenciesInstalled: dependenciesInstalled(modelType: DECISION)\n  }\n  chatModels: playgroundModels(input: {providerKey: $providerKey, modelType: CHAT}) {\n    name\n  }\n  decisionModels: playgroundModels(input: {providerKey: $providerKey, modelType: DECISION}) {\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "2fc991a77b8b4dc7e9260fdb3280b3b6";

export default node;
