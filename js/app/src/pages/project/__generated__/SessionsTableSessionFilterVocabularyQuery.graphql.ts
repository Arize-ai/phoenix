/**
 * @generated SignedSource<<5c0ebefad8ef495498cc892298ebe2e9>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SessionsTableSessionFilterVocabularyQuery$variables = {
  id: string;
};
export type SessionsTableSessionFilterVocabularyQuery$data = {
  readonly project: {
    readonly sessionFilterVocabulary?: ReadonlyArray<{
      readonly category: string;
      readonly description: string;
      readonly iterableName: string | null;
      readonly name: string;
      readonly type: string;
    }>;
  };
};
export type SessionsTableSessionFilterVocabularyQuery = {
  response: SessionsTableSessionFilterVocabularyQuery$data;
  variables: SessionsTableSessionFilterVocabularyQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "FilterVocabularyTerm",
      "kind": "LinkedField",
      "name": "sessionFilterVocabulary",
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
          "name": "type",
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
          "name": "category",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "iterableName",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SessionsTableSessionFilterVocabularyQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SessionsTableSessionFilterVocabularyQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          (v2/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "40a2888a1d5ca2f41532e43b026a6e93",
    "id": null,
    "metadata": {},
    "name": "SessionsTableSessionFilterVocabularyQuery",
    "operationKind": "query",
    "text": "query SessionsTableSessionFilterVocabularyQuery(\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      sessionFilterVocabulary {\n        name\n        type\n        description\n        category\n        iterableName\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "99c0486b11805a81b0c04228d95040f7";

export default node;
