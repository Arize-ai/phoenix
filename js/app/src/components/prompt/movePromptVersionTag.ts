import type { RecordProxy, RecordSourceProxy } from "relay-runtime";
import { ConnectionHandler } from "relay-runtime";

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
  const prompt = store.get(promptId);
  if (!tag || !prompt) {
    return;
  }
  const loadedVersions =
    ConnectionHandler.getConnection(prompt, "PromptVersionsList__pagedVersions")
      ?.getLinkedRecords("edges")
      ?.map((edge) => edge?.getLinkedRecord("node")) ?? [];
  [...loadedVersions, store.get(versionId)].forEach((version) => {
    const versionTags = version?.getLinkedRecords("tags");
    if (!version || !versionTags) {
      return;
    }
    const otherTags = versionTags.filter(
      (versionTag): versionTag is RecordProxy =>
        versionTag != null && versionTag.getDataID() !== tagId
    );
    version.setLinkedRecords(
      version.getDataID() === versionId ? [...otherTags, tag] : otherTags,
      "tags"
    );
  });
}
