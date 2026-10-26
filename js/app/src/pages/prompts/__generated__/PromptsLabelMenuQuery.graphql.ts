/**
 * @generated SignedSource<<45f4b1400d0602ca4636f5991d68a8ba>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PromptsLabelMenuQuery$variables = Record<PropertyKey, never>;
export type PromptsLabelMenuQuery$data = {
  readonly decisionLabels: {
    readonly edges: ReadonlyArray<{
      readonly label: {
        readonly color: string | null;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
  readonly promptLabels: {
    readonly edges: ReadonlyArray<{
      readonly label: {
        readonly color: string | null;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
};
export type PromptsLabelMenuQuery = {
  response: PromptsLabelMenuQuery$data;
  variables: PromptsLabelMenuQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
],
v1 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "id",
    "storageKey": null
  },
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
    "name": "color",
    "storageKey": null
  }
],
v2 = [
  {
    "alias": null,
    "args": (v0/*:: as any*/),
    "concreteType": "PromptLabelConnection",
    "kind": "LinkedField",
    "name": "promptLabels",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "PromptLabelEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": "label",
            "args": null,
            "concreteType": "PromptLabel",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": (v1/*:: as any*/),
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": "promptLabels(first:100)"
  },
  {
    "alias": null,
    "args": (v0/*:: as any*/),
    "concreteType": "DecisionLabelConnection",
    "kind": "LinkedField",
    "name": "decisionLabels",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DecisionLabelEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": "label",
            "args": null,
            "concreteType": "DecisionLabel",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": (v1/*:: as any*/),
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": "decisionLabels(first:100)"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "PromptsLabelMenuQuery",
    "selections": (v2/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "PromptsLabelMenuQuery",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "1c1c1ffc05c7ac9f9e557295360a4db1",
    "id": null,
    "metadata": {},
    "name": "PromptsLabelMenuQuery",
    "operationKind": "query",
    "text": "query PromptsLabelMenuQuery {\n  promptLabels(first: 100) {\n    edges {\n      label: node {\n        id\n        name\n        color\n      }\n    }\n  }\n  decisionLabels(first: 100) {\n    edges {\n      label: node {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a96f822a0925c9db52957c789f98ade1";

export default node;
