import { CopyMultiButton } from "@phoenix/components/core/copy";
import type { CopyItem } from "@phoenix/hooks/useMatchesWithCrumb";

export function NavCopyActionMenu({ items }: { items: CopyItem[] }) {
  return (
    <CopyMultiButton
      items={items}
      size="S"
      className="nav-copy-action-menu__button"
    />
  );
}
