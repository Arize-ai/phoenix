/**
 * @generated SignedSource<<c3ed877b3839b33b10be45497263b4b8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
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
},
v8 = {
  "kind": "TypeDiscriminator",
  "abstractKey": "__isNode"
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
          (v8/*: any*/),
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
          (v8/*: any*/),
          (v2/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "51965c86ef2f0e2192aed200cd90bef9",
    "id": null,
    "metadata": {},
    "name": "TagPromptVersionButtonTagsQuery",
    "operationKind": "query",
    "text": "query TagPromptVersionButtonTagsQuery(\n  $promptId: GlobalID!\n  $versionId: GlobalID!\n) {\n  prompt: node(id: $promptId) {\n    __typename\n    ... on Prompt {\n      versionTags {\n        id\n        name\n      }\n    }\n    __isNode: __typename\n    id\n  }\n  promptVersion: node(id: $versionId) {\n    __typename\n    ... on PromptVersion {\n      tags {\n        id\n        name\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "62f9ce0c869fb321ed64215c26ee5e56";

export default node;
