import { useState } from "react";

import {
  Button,
  Card,
  ContextualHelp,
  Dialog,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  List,
  ListItem,
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
import type { LocalStorageStoreUsage } from "@phoenix/utils/localStorageUsageUtils";
import {
  clearAllLocalStorageStores,
  clearLocalStorageStore,
  readLocalStorageUsage,
} from "@phoenix/utils/localStorageUsageUtils";
import { storageSizeFormatter } from "@phoenix/utils/storageSizeFormatUtils";

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

function StorageStoreRow({ store }: { store: LocalStorageStoreUsage }) {
  const isEmpty = store.entryCount === 0;
  const label = store.label.toLowerCase();
  return (
    <ListItem>
      <Flex direction="row" alignItems="center" gap="size-100">
        <Flex flex="1 1 auto" minWidth={0} alignItems="center" gap="size-50">
          <Text>{store.label}</Text>
          <ContextualHelp variant="info" triggerAriaLabel={`About ${label}`}>
            {store.description}
          </ContextualHelp>
        </Flex>
        <Text color="text-500" size="S">
          {formatUsage(store)}
        </Text>
        <DialogTrigger>
          <Button
            size="S"
            variant="quiet"
            isDisabled={isEmpty}
            leadingVisual={<Icon svg={<Icons.Trash />} />}
            aria-label={`Clear ${label}`}
          />
          <ClearStorageDialog
            title={`Clear ${label}`}
            message={`This removes ${describeUsage(store)} from this browser. ${store.description}`}
            confirmLabel="Clear"
            onConfirm={() =>
              clearAndReload(() => clearLocalStorageStore(store.id))
            }
          />
        </DialogTrigger>
      </Flex>
    </ListItem>
  );
}

export function LocalStorageCard() {
  // Read once on mount: every clear reloads the page, so there is no
  // in-session state to keep in sync.
  const [usage] = useState(readLocalStorageUsage);
  const isEmpty = usage.totalEntryCount === 0;
  const totalUsage: Usage = {
    entryCount: usage.totalEntryCount,
    sizeBytes: usage.totalSizeBytes,
  };

  return (
    <Card
      title="Local Storage"
      titleExtra={
        <ContextualHelp variant="info" triggerAriaLabel="About local storage">
          Phoenix keeps your preferences and UI state in this browser&apos;s
          local storage. Nothing here is sent to the server. Clearing a section
          resets it to its defaults on this device only.
        </ContextualHelp>
      }
      subTitle={
        isEmpty
          ? "Nothing is stored"
          : `${describeUsage(totalUsage)} stored in this browser`
      }
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
            title="Clear all local storage"
            message={`This removes ${describeUsage(totalUsage)} that Phoenix has stored in this browser, including preferences, layouts, playground state, and model provider credentials.`}
            confirmLabel="Clear all"
            onConfirm={() => clearAndReload(clearAllLocalStorageStores)}
          />
        </DialogTrigger>
      }
    >
      <List size="S" aria-label="Local storage sections">
        {usage.stores.map((store) => (
          <StorageStoreRow key={store.id} store={store} />
        ))}
      </List>
    </Card>
  );
}
