import { useEffect, useState } from "react";

import {
  Button,
  Card,
  Flex,
  Icon,
  Icons,
  ProgressBar,
  Text,
  View,
} from "@phoenix/components";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import type { BrowserModelAvailability } from "./browserModel";
import {
  downloadBrowserModel,
  getBrowserBuiltInModel,
  useBrowserModelAvailability,
} from "./browserModel";
import { CardFootnote } from "./CardFootnote";
import { StatusText } from "./StatusText";
import { resolveAISearchModelConfig } from "./types";
import { toErrorMessage } from "./useAISearch";

/**
 * Management surface for Browser AI — the browser's built-in on-device
 * model: whether it is downloaded, a way to download it ahead of first use
 * (with live progress, joining a download already in flight), and how to
 * remove it. Selecting Browser AI for AI search happens in the AI Search
 * card's model picker, not here — this card only reports whether it is in
 * use. The browser owns the download and shares it across every site that
 * uses on-device AI, so removal happens in the browser's own settings —
 * this card explains that rather than pretending to offer it.
 */
export function BrowserModelCard() {
  const builtInModel = getBrowserBuiltInModel();
  const isAISearchEnabled = usePreferencesContext(
    (state) => state.isAISearchEnabled
  );
  const modelConfig = usePreferencesContext(
    (state) => state.aiSearchModelConfig
  );
  const isSelectedForAISearch =
    resolveAISearchModelConfig(modelConfig).kind === "browser";
  const probedAvailability = useBrowserModelAvailability();
  // Local override once this card starts (or joins) a download — the probe
  // stays a pure read of the Prompt API
  const [availabilityOverride, setAvailabilityOverride] =
    useState<BrowserModelAvailability | null>(null);
  const availability = availabilityOverride ?? probedAvailability;
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Downloading is driven off the availability state so that a download
  // already in flight (e.g. kicked off by a first search, or by another
  // tab) is joined on mount and reports progress here too
  useEffect(() => {
    if (availability !== "downloading") {
      return undefined;
    }
    let isCancelled = false;
    downloadBrowserModel((fraction) => {
      if (!isCancelled) {
        setDownloadProgress(fraction);
      }
    }).then(
      () => {
        if (!isCancelled) {
          setAvailabilityOverride("available");
        }
      },
      (error: unknown) => {
        if (!isCancelled) {
          setAvailabilityOverride("needs-download");
          setDownloadError(toErrorMessage(error, "The model download failed"));
        }
      }
    );
    return () => {
      isCancelled = true;
    };
  }, [availability]);

  if (builtInModel === null) {
    return (
      <Card title="Browser AI">
        <View padding="size-200">
          <Text size="S" color="text-700">
            This browser has no built-in AI model, so Browser AI is unavailable
            here. Use a browser with on-device AI, such as Chrome, or choose a
            model provider in the AI Search settings above.
          </Text>
        </View>
      </Card>
    );
  }

  const { modelName, browserName } = builtInModel;

  // At-a-glance model state in the card header; the body holds any
  // state-specific detail (download prompt, progress, unavailability help)
  const renderHeaderStatus = () => {
    switch (availability) {
      case null:
        return (
          <Text size="XS" color="text-500">
            Checking status…
          </Text>
        );
      case "available":
        return <StatusText tone="success">Downloaded and ready</StatusText>;
      case "needs-download":
        return <StatusText>Not downloaded</StatusText>;
      case "downloading":
        return (
          <StatusText>
            Downloading… {Math.round(downloadProgress * 100)}%
          </StatusText>
        );
      default:
        return (
          <StatusText tone="warning">Unavailable on this device</StatusText>
        );
    }
  };

  // The mutually exclusive detail section under the description, one branch
  // per availability that needs explanation or action
  const renderStatusDetail = () => {
    switch (availability) {
      case "needs-download":
        return (
          <Flex direction="column" gap="size-100" alignItems="start">
            <Text size="XS" color="text-700">
              AI search downloads the model automatically the first time you run
              a search with Browser AI selected, or you can download it now. It
              is a one-time, multi-gigabyte download.
            </Text>
            {downloadError !== null ? (
              <Text size="XS" color="danger">
                {downloadError}
              </Text>
            ) : null}
            <Button
              size="S"
              onPress={() => {
                setDownloadProgress(0);
                setDownloadError(null);
                setAvailabilityOverride("downloading");
              }}
            >
              Download model
            </Button>
          </Flex>
        );
      case "downloading":
        return (
          <ProgressBar
            value={downloadProgress * 100}
            width="100%"
            aria-label="Model download progress"
          />
        );
      case "unavailable":
      case "unsupported":
        return (
          <Text size="XS" color="warning">
            The model can’t be set up on this device — {browserName} reports it
            as unavailable, often due to unsupported hardware or low disk space.
            Use a model provider instead.
          </Text>
        );
      default:
        return null;
    }
  };

  return (
    <Card title="Browser AI" extra={renderHeaderStatus()}>
      <View padding="size-200">
        <Flex direction="column" gap="size-200">
          <Text size="S">
            {modelName} — {browserName}’s built-in model. It runs entirely on
            this device; the download is managed by {browserName} and shared
            across every site that uses on-device AI.
          </Text>
          {renderStatusDetail()}
          <Text size="XS" color="text-700">
            {!isAISearchEnabled
              ? "Not in use — AI Search is turned off."
              : isSelectedForAISearch
                ? "In use by AI Search — filter fields translate natural language with this model."
                : "Not in use — AI Search is set to a different model."}
          </Text>
          <CardFootnote icon={<Icon svg={<Icons.Info />} />}>
            Phoenix can’t delete the model — {browserName} owns the download.
            {browserName === "Chrome" ? (
              <>
                {" "}
                To remove it from this device, open{" "}
                <code>chrome://settings/system</code> and turn off “On-device
                AI”. Chrome also removes the model automatically when it goes
                unused or disk space runs low.
              </>
            ) : (
              <>
                {" "}
                Manage or remove it from {browserName}’s on-device AI settings.
              </>
            )}
          </CardFootnote>
        </Flex>
      </View>
    </Card>
  );
}
