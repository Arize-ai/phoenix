# Upsert Dataset Test Cases

## Deduplication: matched pairs

The 8 combinations of (prev has ext_id) × (request has ext_id) × (content hash match/differ).
Names follow the pattern: `test_upsert_{prev_ext_id}_{req_ext_id}_{hash}_{outcome}`

- test_upsert_ext_id_ext_id_matching_hash_carries_over
  - Previous version has an example with external_id="foo" and content_hash=H. Request has an example with the same external_id and same content_hash. Matched by external_id; carries over silently, no new revision.

- test_upsert_ext_id_ext_id_differing_hash_adds_patch_revision
  - Previous version has an example with external_id="foo" and content_hash=H1. Request has an example with the same external_id and content_hash=H2. Matched by external_id; existing DatasetExample row reused with a PATCH revision containing the new content.

- test_upsert_ext_id_no_ext_id_matching_hash_carries_over
  - Previous version has an example with external_id="foo" and content_hash=H. Request has an example with no external_id and the same content_hash=H. No match by external_id; falls back to content hash match; carries over silently.

- test_upsert_ext_id_no_ext_id_differing_hash_adds_delete_revision
  - Previous version has an example with external_id="foo" and content_hash=H1. Request has no example with that external_id and no example with content_hash=H1. No match; the previous example gets a DELETE revision.

- test_upsert_no_ext_id_ext_id_matching_hash_carries_over
  - Previous version has an example with no external_id and content_hash=H. Request has an example with external_id="foo" and the same content_hash=H. No match by external_id (previous has none); falls back to content hash match; carries over silently. No external_id written to the existing row.

- test_upsert_no_ext_id_ext_id_differing_hash_creates_and_deletes
  - Previous version has an example with no external_id and content_hash=H1. Request has an example with external_id="foo" and content_hash=H2. No match by external_id or content hash; new DatasetExample with external_id="foo" gets a CREATE revision; old example gets a DELETE revision.

- test_upsert_no_ext_id_no_ext_id_matching_hash_carries_over
  - Previous version has an example with no external_id and content_hash=H. Request has an example with no external_id and the same content_hash=H. Matched by content hash; carries over silently, no new revision.

- test_upsert_no_ext_id_no_ext_id_differing_hash_creates_and_deletes
  - Previous version has an example with no external_id and content_hash=H1. Request has an example with no external_id and content_hash=H2. No match; old example gets a DELETE revision, new example gets a CREATE revision on a new DatasetExample row.

## Deduplication: deleted examples

- test_upsert_deleted_ext_id_example_recreated_on_upsert
  - Previous version has an example with external_id="foo" whose most recent revision_kind is DELETE. Request has an example with the same external_id. A new DatasetExample row and CREATE revision are added.

- test_upsert_deleted_no_ext_id_example_recreated_on_upsert
  - Previous version has an example with no external_id and content_hash=H whose most recent revision_kind is DELETE. Request has an example with the same content_hash=H and no external_id. A new DatasetExample row and CREATE revision are added.

## Deduplication: cardinality

- test_upsert_same_hash_prev_one_req_many_adds_create_revision
  - Previous version has one example with content_hash=H (no external_id). Request has two examples with the same content_hash=H. One carries over; the second gets a new DatasetExample row and CREATE revision.

- test_upsert_same_hash_prev_many_req_one_adds_delete_revision
  - Previous version has two examples with content_hash=H (no external_id). Request has one example with content_hash=H. One carries over; the other gets a DELETE revision.

## Mixed batches

- test_upsert_batch_with_mix_of_new_unchanged_and_changed_examples
  - Single request containing: one new example (no prior match), one unchanged example (carried over), and one changed example (PATCH or DELETE+CREATE depending on external_id presence). Verify each is handled correctly.

- test_upsert_batch_with_mix_of_examples_with_and_without_external_ids
  - Some examples have external_ids (use external_id deduplication path), others do not (use content hash path). Verify both paths run correctly within the same request.

## Dataset lifecycle

- test_upsert_creates_new_dataset_when_name_does_not_exist
  - Request names a dataset that does not yet exist. A new Dataset and DatasetVersion are created.

- test_upsert_creates_new_version_on_existing_dataset
  - Request provides a name selector pointing to an existing dataset. A new DatasetVersion is created on that dataset.

- test_upsert_does_not_create_new_version_for_unchanged_examples
  - Every example in the request carries over from the previous version. No new DatasetVersion row is created; the response returns the existing version_id.

- test_upsert_with_no_prior_version_creates_all_examples
  - Dataset exists but has no previous version. All examples in the request are treated as new: a DatasetVersion is created and every example gets a new DatasetExample row and CREATE revision.

## Content hash correctness

- test_upsert_examples_differing_only_in_key_order_share_same_content_hash
  - Two examples with identical input/output/metadata values but different JSON key ordering produce the same content hash (via canonical JSON serialization), and are therefore treated as the same example.

## Validation / error cases

- test_upsert_duplicate_external_ids_in_request_returns_422
  - Upsert request contains two examples with the same external_id. Returns 422 with an error message identifying the duplicate.

- test_upsert_outputs_length_mismatch_with_inputs_returns_422
  - Upsert request has outputs list of different length than inputs. Returns 422.

- test_upsert_metadata_length_mismatch_with_inputs_returns_422
  - Upsert request has metadata list of different length than inputs. Returns 422.

- test_upsert_external_ids_length_mismatch_with_inputs_returns_422
  - Upsert request has external_ids list of different length than inputs. Returns 422.

- test_upsert_missing_name_returns_422
  - Request body is missing the name field. Returns 422.

- test_upsert_missing_inputs_returns_422
  - Request body is missing the inputs field. Returns 422.

## Edge cases

- test_upsert_empty_examples_list_does_not_create_new_version
  - Request is valid but examples list is empty. No DatasetVersion row is created.
