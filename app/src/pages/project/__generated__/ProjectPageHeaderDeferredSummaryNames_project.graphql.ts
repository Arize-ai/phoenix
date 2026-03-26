/**
 * @generated SignedSource<<bf2f775d1f5448a46c330cd436541b2b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectPageHeaderDeferredSummaryNames_project$data = {
  readonly documentEvaluationNames: ReadonlyArray<string>;
  readonly spanAnnotationNames: ReadonlyArray<string>;
  readonly " $fragmentType": "ProjectPageHeaderDeferredSummaryNames_project";
};
export type ProjectPageHeaderDeferredSummaryNames_project$key = {
  readonly " $data"?: ProjectPageHeaderDeferredSummaryNames_project$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectPageHeaderDeferredSummaryNames_project">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "ProjectPageHeaderDeferredSummaryNames_project",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "spanAnnotationNames",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "documentEvaluationNames",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};

(node as any).hash = "f52324a4055411595938afc89c1967c1";

export default node;
