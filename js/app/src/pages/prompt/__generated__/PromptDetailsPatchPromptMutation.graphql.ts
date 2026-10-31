/**
 * @generated SignedSource<<9f68e22ad3e7b08ac1a3ce12fbcd26b2>>
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
export type PromptDetailsPatchPromptMutation$variables = {
  input: PatchPromptInput;
};
export type PromptDetailsPatchPromptMutation$data = {
  readonly patchPrompt: {
    readonly " $fragmentSpreads": FragmentRefs<"PromptDetails_data" | "PromptLayout__main">;
  };
};
export type PromptDetailsPatchPromptMutation = {
  response: PromptDetailsPatchPromptMutation$data;
  variables: PromptDetailsPatchPromptMutation$variables;
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
    "name": "PromptDetailsPatchPromptMutation",
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
            "name": "PromptDetails_data"
          },
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
    "name": "PromptDetailsPatchPromptMutation",
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
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "metadata",
            "storageKey": null
          },
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
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "versionCount",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "4bba8e39dda4275e77a6f07dea66e0d2",
    "id": null,
    "metadata": {},
    "name": "PromptDetailsPatchPromptMutation",
    "operationKind": "mutation",
    "text": "mutation PromptDetailsPatchPromptMutation(\n  $input: PatchPromptInput!\n) {\n  patchPrompt(input: $input) {\n    ...PromptDetails_data\n    ...PromptLayout__main\n    id\n  }\n}\n\nfragment PromptDetails_data on Prompt {\n  id\n  metadata\n}\n\nfragment PromptLayout__main on Prompt {\n  id\n  name\n  description\n  metadata\n  labels {\n    id\n    name\n    color\n  }\n  sourcePrompt {\n    id\n    name\n  }\n  latestVersion: promptVersions(first: 1) {\n    edges {\n      node {\n        id\n      }\n    }\n  }\n  versionCount\n}\n"
  }
};
})();

(node as any).hash = "a4b4560b180e3105bd764f161d3207b7";

export default node;
