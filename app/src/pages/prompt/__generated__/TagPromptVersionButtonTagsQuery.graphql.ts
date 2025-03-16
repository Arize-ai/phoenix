/**
 * @generated SignedSource<<d3d75e20284729d2e8dfbd1fa713551e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type TagPromptVersionButtonTagsQuery$variables = {
  promptId: string;
  versionId: string;
};
export type TagPromptVersionButtonTagsQuery$data = {
  readonly prompt: {
    readonly versionTags?: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
    }>;
  };
  readonly promptVersion: {
    readonly tags?: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
    }>;
  };
};
export type TagPromptVersionButtonTagsQuery = {
  response: TagPromptVersionButtonTagsQuery$data;
  variables: TagPromptVersionButtonTagsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "promptId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "versionId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "promptId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = [
  (v2/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "name",
    "storageKey": null
  }
],
v4 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptVersionTag",
      "kind": "LinkedField",
      "name": "versionTags",
      "plural": true,
      "selections": (v3/*: any*/),
      "storageKey": null
    }
  ],
  "type": "Prompt",
  "abstractKey": null
},
v5 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "versionId"
  }
],
v6 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptVersionTag",
      "kind": "LinkedField",
      "name": "tags",
      "plural": true,
      "selections": (v3/*: any*/),
      "storageKey": null
    }
  ],
  "type": "PromptVersion",
  "abstractKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TagPromptVersionButtonTagsQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": "promptVersion",
        "args": (v5/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v6/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "TagPromptVersionButtonTagsQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v7/*: any*/),
          (v4/*: any*/),
          (v2/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": "promptVersion",
        "args": (v5/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v7/*: any*/),
          (v6/*: any*/),
          (v2/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "07290a8880ce785c72cb316417da40f0",
    "id": null,
    "metadata": {},
    "name": "TagPromptVersionButtonTagsQuery",
    "operationKind": "query",
    "text": "query TagPromptVersionButtonTagsQuery(\n  $promptId: ID!\n  $versionId: ID!\n) {\n  prompt: node(id: $promptId) {\n    __typename\n    ... on Prompt {\n      versionTags {\n        id\n        name\n      }\n    }\n    id\n  }\n  promptVersion: node(id: $versionId) {\n    __typename\n    ... on PromptVersion {\n      tags {\n        id\n        name\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "6f96cbb8864a597a74d85547a9b49ed0";

export default node;
