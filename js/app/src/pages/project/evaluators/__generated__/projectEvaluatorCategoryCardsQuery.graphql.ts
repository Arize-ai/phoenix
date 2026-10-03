/**
 * @generated SignedSource<<a85df42485d6c69b61bdd55da966d39f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluatorCategory = "AGENTS" | "GROUNDING_AND_RETRIEVAL" | "RESPONSE_QUALITY" | "SAFETY_AND_SECURITY" | "USER_EXPERIENCE";
export type projectEvaluatorCategoryCardsQuery$variables = Record<PropertyKey, never>;
export type projectEvaluatorCategoryCardsQuery$data = {
  readonly evaluatorGalleryConfigs: ReadonlyArray<{
    readonly category: EvaluatorCategory | null;
    readonly name: string;
  }>;
};
export type projectEvaluatorCategoryCardsQuery = {
  response: projectEvaluatorCategoryCardsQuery$data;
  variables: projectEvaluatorCategoryCardsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "ClassificationEvaluatorConfig",
    "kind": "LinkedField",
    "name": "evaluatorGalleryConfigs",
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
        "name": "category",
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
    "name": "projectEvaluatorCategoryCardsQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "projectEvaluatorCategoryCardsQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "37f203807a26e3217d23ff16be421fca",
    "id": null,
    "metadata": {},
    "name": "projectEvaluatorCategoryCardsQuery",
    "operationKind": "query",
    "text": "query projectEvaluatorCategoryCardsQuery {\n  evaluatorGalleryConfigs {\n    name\n    category\n  }\n}\n"
  }
};
})();

(node as any).hash = "e41ebc1806e1a898862f3022618e20b9";

export default node;
