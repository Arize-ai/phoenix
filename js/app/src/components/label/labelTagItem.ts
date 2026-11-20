import type { TagGroupItem } from "@phoenix/components";

/**
 * A label, split or other named object a person colored, as a `TagGroup`
 * item. The stored color passes through as the tag's `userColor`; an
 * object with no color is a neutral tag.
 */
export function labelTagItem(label: {
  id: string;
  name: string;
  color?: string | null;
}): TagGroupItem {
  return label.color
    ? { id: label.id, label: label.name, userColor: label.color }
    : { id: label.id, label: label.name };
}
