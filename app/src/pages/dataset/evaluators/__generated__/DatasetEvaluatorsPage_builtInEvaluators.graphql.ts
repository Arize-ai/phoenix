/**
 * @generated SignedSource<<9743976f7832c1088bb5e7ea0b939aee>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DatasetEvaluatorsPage_builtInEvaluators$data = {
  readonly builtInEvaluators: ReadonlyArray<{
    readonly description: string | null;
    readonly id: string;
    readonly name: string;
  }>;
  readonly classificationEvaluatorConfigs: ReadonlyArray<{
    readonly description: string | null;
    readonly name: string;
  }>;
  readonly " $fragmentType": "DatasetEvaluatorsPage_builtInEvaluators";
};
export type DatasetEvaluatorsPage_builtInEvaluators$key = {
  readonly " $data"?: DatasetEvaluatorsPage_builtInEvaluators$data;
  readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorsPage_builtInEvaluators">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DatasetEvaluatorsPage_builtInEvaluators",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "BuiltInEvaluator",
      "kind": "LinkedField",
      "name": "builtInEvaluators",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "id",
          "storageKey": null
        },
        (v0/*: any*/),
        (v1/*: any*/)
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "ClassificationEvaluatorConfig",
      "kind": "LinkedField",
      "name": "classificationEvaluatorConfigs",
      "plural": true,
      "selections": [
        (v0/*: any*/),
        (v1/*: any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "64b93d6bd425c623c6ec705792c91a35";

export default node;
