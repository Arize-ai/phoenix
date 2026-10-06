import { css } from "@emotion/react";
import { useState } from "react";

import {
  Button,
  Card,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import type {
  LocalStorageStoreId,
  LocalStorageStoreUsage,
} from "@phoenix/utils/localStorageUsageUtils";
import {
  clearAllLocalStorageStores,
  clearLocalStorageStore,
  readLocalStorageUsage,
} from "@phoenix/utils/localStorageUsageUtils";
import { storageSizeFormatter } from "@phoenix/utils/storageSizeFormatUtils";

const storageListCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  margin: 0;
  padding: 0;
  list-style: none;
`;

const storageRowCSS = css`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--global-dimension-size-200);
  padding: var(--global-dimension-size-150);
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  background: var(--global-background-color-primary);

  .storage-row__details {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: var(--global-dimension-size-75);
    min-width: 0;
  }
`;

type Usage = { entryCount: number; sizeBytes: number };

function formatEntryCount(entryCount: number): string {
  return entryCount === 1 ? "1 entry" : `${entryCount} entries`;
}

/** Row meta, e.g. "3 entries · 1.2 KiB", or "Empty". */
function formatUsage({ entryCount, sizeBytes }: Usage): string {
  if (entryCount === 0) {
    return "Empty";
  }
  return `${formatEntryCount(entryCount)} · ${storageSizeFormatter(sizeBytes)}`;
}

/** Mid-sentence usage, e.g. "3 entries (1.2 KiB)". Callers handle empty. */
function describeUsage({ entryCount, sizeBytes }: Usage): string {
  return `${formatEntryCount(entryCount)} (${storageSizeFormatter(sizeBytes)})`;
}

/**
 * Clears storage and reloads the page so every store rehydrates from its
 * defaults. Without the reload, in-memory stores would write their current
 * state straight back on the next change.
 */
function clearAndReload(clear: () => void) {
  clear();
  window.location.reload();
}

function ClearStorageDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <ModalOverlay isDismissable>
      <Modal>
        <Dialog>
          {({ close }) => (
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <View padding="size-200">
                <Flex direction="column" gap="size-100">
                  <Text>{message}</Text>
                  <Text color="text-500" size="S">
                    Phoenix will reload to apply the defaults. This cannot be
                    undone.
                  </Text>
                </Flex>
              </View>
              <DialogFooter>
                <Button slot="close" size="S">
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="S"
                  onPress={() => {
                    close();
                    onConfirm();
                  }}
                >
                  {confirmLabel}
                </Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function StorageStoreRow({
  store,
  onClear,
}: {
  store: LocalStorageStoreUsage;
  onClear: (storeId: LocalStorageStoreId) => void;
}) {
  const isEmpty = store.entryCount === 0;
  return (
    <li css={storageRowCSS} data-testid={`storage-store-${store.id}`}>
      <span className="storage-row__details">
        <Text weight="heavy">{store.label}</Text>
        <Text color="text-500" size="S">
          {store.description}
        </Text>
        <Text color="text-700" size="S">
          {formatUsage(store)}
        </Text>
      </span>
      <DialogTrigger>
        <Button
          size="S"
          isDisabled={isEmpty}
          leadingVisual={<Icon svg={<Icons.Trash />} />}
          aria-label={`Clear ${store.label.toLowerCase()} storage`}
        >
          Clear
        </Button>
        <ClearStorageDialog
          title={`Clear ${store.label.toLowerCase()}`}
          message={`This removes ${describeUsage(store)} from this browser. ${store.description}`}
          confirmLabel="Clear"
          onConfirm={() => onClear(store.id)}
        />
      </DialogTrigger>
    </li>
  );
}

export function ProfileStoragePage() {
  // Read once on mount: every clear reloads the page, so there is no
  // in-session state to keep in sync.
  const [usage] = useState(() => readLocalStorageUsage());
  const isEmpty = usage.totalEntryCount === 0;
  const totalUsage: Usage = {
    entryCount: usage.totalEntryCount,
    sizeBytes: usage.totalSizeBytes,
  };

  return (
    <Card
      title="Browser Storage"
      extra={
        <DialogTrigger>
          <Button
            variant="danger"
            size="S"
            isDisabled={isEmpty}
            leadingVisual={<Icon svg={<Icons.Trash />} />}
          >
            Clear all
          </Button>
          <ClearStorageDialog
            title="Clear all browser storage"
            message={`This removes ${describeUsage(totalUsage)} that Phoenix has stored in this browser, including preferences, layouts, playground state, and model provider credentials.`}
            confirmLabel="Clear all"
            onConfirm={() => clearAndReload(() => clearAllLocalStorageStores())}
          />
        </DialogTrigger>
      }
    >
      <View padding="size-200">
        <Flex direction="column" gap="size-200">
          <Flex direction="column" gap="size-75">
            <Text color="text-700">
              Phoenix keeps your preferences and UI state in this browser&apos;s
              local storage. Nothing here is sent to the server. Clearing a
              section resets it to its defaults on this device only.
            </Text>
            <Text color="text-500" size="S" data-testid="storage-total">
              {isEmpty
                ? "Nothing is currently stored."
                : `${describeUsage(totalUsage)} stored across all sections.`}
            </Text>
          </Flex>
          <ul css={storageListCSS} aria-label="Browser storage sections">
            {usage.stores.map((store) => (
              <StorageStoreRow
                key={store.id}
                store={store}
                onClear={(storeId) =>
                  clearAndReload(() => clearLocalStorageStore(storeId))
                }
              />
            ))}
          </ul>
        </Flex>
      </View>
    </Card>
  );
}
