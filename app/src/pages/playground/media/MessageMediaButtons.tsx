import { AddMediaInputButton } from "../AddMediaInputButton";

/**
 * The media buttons on a message's toolbar.
 *
 * One element for the toolbar to render, rather than two buttons and a role check
 * inline: the toolbar belongs to upstream and gains items over time, so the fork's
 * contribution to it is kept to a single line.
 */
export function MessageMediaButtons({
  instanceId,
  messageId,
  role,
}: {
  instanceId: number;
  messageId: number;
  role: string;
}) {
  if (role !== "user") {
    return null;
  }
  return (
    <>
      <AddMediaInputButton
        instanceId={instanceId}
        messageId={messageId}
        kind="image"
      />
      <AddMediaInputButton
        instanceId={instanceId}
        messageId={messageId}
        kind="file"
      />
    </>
  );
}
