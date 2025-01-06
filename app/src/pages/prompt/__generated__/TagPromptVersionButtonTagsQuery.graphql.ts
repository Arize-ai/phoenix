/**
 * @generated SignedSource<<cee7c2adddc62ddcfee89f8cf89ea117>>
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
      readonly name: string;
    }>;
  };
  readonly promptVersion: {
    readonly tags?: ReadonlyArray<{
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
v2 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "name",
    "storageKey": null
  }
],
v3 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptVersionTag",
      "kind": "LinkedField",
      "name": "versionTags",
      "plural": true,
      "selections": (v2/*: any*/),
      "storageKey": null
    }
  ],
  "type": "Prompt",
  "abstractKey": null
},
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "versionId"
  }
],
v5 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptVersionTag",
      "kind": "LinkedField",
      "name": "tags",
      "plural": true,
      "selections": (v2/*: any*/),
      "storageKey": null
    }
  ],
  "type": "PromptVersion",
  "abstractKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v7 = {
  "kind": "TypeDiscriminator",
  "abstractKey": "__isNode"
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
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
          (v3/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": "promptVersion",
        "args": (v4/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v5/*: any*/)
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
          (v6/*: any*/),
          (v3/*: any*/),
          (v7/*: any*/),
          (v8/*: any*/)
        ],
        "storageKey": null
      },
      {
        "alias": "promptVersion",
        "args": (v4/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v6/*: any*/),
          (v5/*: any*/),
          (v7/*: any*/),
          (v8/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "b48470da2466dee71014e5298fe3c154",
    "id": null,
    "metadata": {},
    "name": "TagPromptVersionButtonTagsQuery",
    "operationKind": "query",
    "text": "query TagPromptVersionButtonTagsQuery(\n  $promptId: GlobalID!\n  $versionId: GlobalID!\n) {\n  prompt: node(id: $promptId) {\n    __typename\n    ... on Prompt {\n      versionTags {\n        name\n      }\n    }\n    __isNode: __typename\n    id\n  }\n  promptVersion: node(id: $versionId) {\n    __typename\n    ... on PromptVersion {\n      tags {\n        name\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "cf7f23baada0854d6f6fd67fb234239f";

export default node;
