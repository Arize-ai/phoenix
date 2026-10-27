/**
 * @generated SignedSource<<582b6f7a016f5005851e4b1ac6084ca9>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PatchPromptInput = {
  description?: string | null;
  metadata?: any | null;
  promptId: string;
};
export type PromptPageHeaderPatchPromptMutation$variables = {
  input: PatchPromptInput;
};
export type PromptPageHeaderPatchPromptMutation$data = {
  readonly patchPrompt: {
    readonly " $fragmentSpreads": FragmentRefs<"PromptLayout__main">;
  };
};
export type PromptPageHeaderPatchPromptMutation = {
  response: PromptPageHeaderPatchPromptMutation$data;
  variables: PromptPageHeaderPatchPromptMutation$variables;
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
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PromptPageHeaderPatchPromptMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "Prompt",
        "kind": "LinkedField",
        "name": "patchPrompt",
        "plural": false,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "PromptLayout__main"
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "PromptPageHeaderPatchPromptMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "Prompt",
        "kind": "LinkedField",
        "name": "patchPrompt",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
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
            "name": "metadata",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "PromptLabel",
            "kind": "LinkedField",
            "name": "labels",
            "plural": true,
            "selections": [
              (v2/*:: as any*/),
              (v3/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "color",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "Prompt",
            "kind": "LinkedField",
            "name": "sourcePrompt",
            "plural": false,
            "selections": [
              (v2/*:: as any*/),
              (v3/*:: as any*/)
            ],
            "storageKey": null
          },
          {
            "alias": "latestVersion",
            "args": [
              {
                "kind": "Literal",
                "name": "first",
                "value": 1
              }
            ],
            "concreteType": "PromptVersionConnection",
            "kind": "LinkedField",
            "name": "promptVersions",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "PromptVersionEdge",
                "kind": "LinkedField",
                "name": "edges",
                "plural": true,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptVersion",
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
                    "selections": [
                      (v2/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": "promptVersions(first:1)"
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "df52140fbfe5759c8a45522ae919f6f7",
    "id": null,
    "metadata": {},
    "name": "PromptPageHeaderPatchPromptMutation",
    "operationKind": "mutation",
    "text": "mutation PromptPageHeaderPatchPromptMutation(\n  $input: PatchPromptInput!\n) {\n  patchPrompt(input: $input) {\n    ...PromptLayout__main\n    id\n  }\n}\n\nfragment PromptLayout__main on Prompt {\n  id\n  name\n  description\n  metadata\n  labels {\n    id\n    name\n    color\n  }\n  sourcePrompt {\n    id\n    name\n  }\n  latestVersion: promptVersions(first: 1) {\n    edges {\n      node {\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e63675d8f66a08f8ab53abea2f1ddff1";

export default node;
