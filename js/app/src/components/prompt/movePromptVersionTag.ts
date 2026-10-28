import type { RecordProxy, RecordSourceProxy } from "relay-runtime";
import { ConnectionHandler } from "relay-runtime";

function getLoadedVersions({
  store,
  promptId,
}: {
  store: RecordSourceProxy;
  promptId: string;
}) {
  const prompt = store.get(promptId);
  if (!prompt) {
    return [];
  }
  return (
    ConnectionHandler.getConnection(prompt, "PromptVersionsList__pagedVersions")
      ?.getLinkedRecords("edges")
      ?.map((edge) => edge?.getLinkedRecord("node")) ?? []
  );
}

function withoutTag(version: RecordProxy, tagId: string) {
  return (version.getLinkedRecords("tags") ?? []).filter(
    (versionTag): versionTag is RecordProxy =>
      versionTag != null && versionTag.getDataID() !== tagId
  );
}

/**
 * Store update for `setPromptVersionTag`. A tag belongs to one version at a
 * time, so it is added to the tagged version and removed from every other
 * version loaded in the prompt's paginated versions list.
 */
export function movePromptVersionTag({
  store,
  promptId,
  versionId,
  tagId,
}: {
  store: RecordSourceProxy;
  promptId: string;
  versionId: string;
  tagId: string;
}) {
  const tag = store.get(tagId);
  if (!tag || !store.get(promptId)) {
    return;
  }
  [...getLoadedVersions({ store, promptId }), store.get(versionId)].forEach(
    (version) => {
      if (!version || !version.getLinkedRecords("tags")) {
        return;
      }
      const otherTags = withoutTag(version, tagId);
      version.setLinkedRecords(
        version.getDataID() === versionId ? [...otherTags, tag] : otherTags,
        "tags"
      );
    }
  );
}

/**
 * Store update for `deletePromptVersionTag`: the tag is removed from the
 * version that held it and from every version loaded in the prompt's
 * paginated versions list.
 */
export function removePromptVersionTag({
  store,
  promptId,
  versionId,
  tagId,
}: {
  store: RecordSourceProxy;
  promptId: string;
  versionId: string;
  tagId: string;
}) {
  [...getLoadedVersions({ store, promptId }), store.get(versionId)].forEach(
    (version) => {
      if (!version || !version.getLinkedRecords("tags")) {
        return;
      }
      version.setLinkedRecords(withoutTag(version, tagId), "tags");
    }
  );
}
