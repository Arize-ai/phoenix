/**
 * @generated SignedSource<<293d129561c0e2ec4ad74ce36b27258e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DatasetEvaluatorTraces_project$data = {
  readonly id: string;
  readonly " $fragmentSpreads": FragmentRefs<"TracesTable_spans">;
  readonly " $fragmentType": "DatasetEvaluatorTraces_project";
};
export type DatasetEvaluatorTraces_project$key = {
  readonly " $data"?: DatasetEvaluatorTraces_project$data;
  readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorTraces_project">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DatasetEvaluatorTraces_project",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "TracesTable_spans"
    }
  ],
  "type": "Project",
  "abstractKey": null
};

(node as any).hash = "a8bd59ba91916f6e5cb2383bfe9890ca";

export default node;
