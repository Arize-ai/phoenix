/**
 * @generated SignedSource<<7923daf01db6a9098673be4ab855140d>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SessionFilterConditionFieldVocabularyQuery$variables = {
  id: string;
};
export type SessionFilterConditionFieldVocabularyQuery$data = {
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
export type SessionFilterConditionFieldVocabularyQuery = {
  response: SessionFilterConditionFieldVocabularyQuery$data;
  variables: SessionFilterConditionFieldVocabularyQuery$variables;
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
    "name": "SessionFilterConditionFieldVocabularyQuery",
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
    "name": "SessionFilterConditionFieldVocabularyQuery",
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
    "cacheID": "ce769f4e22791a7a2282a8d331116976",
    "id": null,
    "metadata": {},
    "name": "SessionFilterConditionFieldVocabularyQuery",
    "operationKind": "query",
    "text": "query SessionFilterConditionFieldVocabularyQuery(\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      sessionFilterVocabulary {\n        name\n        type\n        description\n        category\n        iterableName\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "a315f91ed0f59f2866b1d6c32331eb61";

export default node;
