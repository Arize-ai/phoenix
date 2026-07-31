import { promptContentPartSchema } from "@phoenix/schemas/messageSchemas";

/**
 * A message with the content parts the code export cannot represent removed.
 *
 * The export's query asks only for text, tool calls and tool results, so a media
 * part arrives as an empty object. `promptContentPartSchema` is a discriminated
 * union on `__typename`, so that empty object fails to parse — and because content
 * is parsed as a whole array, the failure takes the *entire message* with it. The
 * caller catches, logs "Cannot convert message", and filters it out, so a prompt
 * carrying one image silently loses that message's text and tool calls from the
 * generated snippet too.
 *
 * Dropping just the unrepresentable part keeps the rest. The media is still missing
 * from the snippet, which is the known limitation; losing the message around it was
 * not intended.
 */
export function withRepresentableContentOnly<
  T extends { content?: readonly unknown[] | null },
>(message: T): T {
  const content = message.content;
  if (!Array.isArray(content)) {
    return message;
  }
  const representable = content.filter(
    (part) => promptContentPartSchema.safeParse(part).success
  );
  return representable.length === content.length
    ? message
    : { ...message, content: representable };
}
