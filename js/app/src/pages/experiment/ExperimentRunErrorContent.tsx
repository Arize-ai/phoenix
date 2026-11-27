import { css } from "@emotion/react";

import { Flex, Icon, Icons, View } from "@phoenix/components";
import { PlainJSONBlock } from "@phoenix/components/code/PlainJSONBlock";
import { PrettyText } from "@phoenix/components/utility/PrettyText";
import { usePrettyText } from "@phoenix/hooks/usePrettyText";
import { isWhitespaceOnlyReformat } from "@phoenix/utils/jsonUtils";

/**
 * An experiment run's error: a danger icon beside the message, shown as JSON
 * when the message is JSON.
 */
export function ExperimentRunErrorContent({ error }: { error: string }) {
  const { text, textType } = usePrettyText(error);
  const preserveOriginalJSON =
    textType === "json" && !isWhitespaceOnlyReformat(error, text);
  return (
    <Flex direction="row" gap="size-100" alignItems="start">
      <Icon
        svg={<Icons.AlertCircle />}
        color="danger"
        role="img"
        aria-label="Error"
        css={css`
          flex-shrink: 0;
          /* Match the top padding of CodeMirror's first line. */
          margin-top: ${textType === "json"
            ? "var(--global-dimension-size-50)"
            : "0"};
        `}
      />
      <View flex="1" minWidth={0}>
        {textType === "json" ? (
          <PlainJSONBlock value={preserveOriginalJSON ? error : text} />
        ) : (
          <PrettyText>{error}</PrettyText>
        )}
      </View>
    </Flex>
  );
}
