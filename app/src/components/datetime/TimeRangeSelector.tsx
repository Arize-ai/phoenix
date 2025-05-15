import { PropsWithChildren } from "react";
import { Dialog, DialogTrigger } from "react-aria-components";
import { css } from "@emotion/react";

import {
  Button,
  Flex,
  Heading,
  Icon,
  Icons,
  ListBox,
  ListBoxItem,
  Popover,
  PopoverArrow,
  SelectChevronUpDownIcon,
  TimeRangeForm,
  View,
} from "@phoenix/components";
import { timeRangeFormatter } from "@phoenix/utils/timeFormatUtils";

import { LAST_N_TIME_RANGES } from "./constants";
import { OpenTimeRangeWithKey } from "./types";
import { getTimeRangeFromLastNTimeRangeKey, isTimeRangeKey } from "./utils";

export type TimeRangeSelectorProps = {
  isDisabled?: boolean;
  value: OpenTimeRangeWithKey;
  onChange: (timeRange: OpenTimeRangeWithKey) => void;
};

const listBoxCSS = css`
  width: 130px;
`;

/**
 * Get the display text for the time range key. Shows the explicit time range in the case of "custom"
 */
function getDisplayText({ timeRangeKey, start, end }: OpenTimeRangeWithKey) {
  if (timeRangeKey === "custom") {
    return timeRangeFormatter({ start, end });
  }
  const rangeValue = LAST_N_TIME_RANGES.find(
    (range) => range.key === timeRangeKey
  );
  if (!rangeValue) {
    // Should never happen but must make sure to handle it
    return "invalid";
  }
  return rangeValue.label;
}

export function TimeRangeSelector(props: TimeRangeSelectorProps) {
  const { value, isDisabled, onChange } = props;
  const { timeRangeKey, start, end } = value;
  return (
    <DialogTrigger>
      <Button
        size="S"
        leadingVisual={<Icon svg={<Icons.CalendarOutline />} />}
        isDisabled={isDisabled}
      >
        {getDisplayText(value)}
        <SelectChevronUpDownIcon />
      </Button>
      <Popover placement="bottom end">
        <Dialog>
          {({ close }) => (
            <>
              <PopoverArrow />
              <Flex direction="row">
                <CustomTimeRangeWrap visible={timeRangeKey === "custom"}>
                  {/* We force re-mount to reset the dirty state in the form */}
                  {timeRangeKey === "custom" && (
                    <Flex
                      direction="column"
                      gap="size-100"
                      justifyContent="end"
                      height="100%"
                    >
                      <Heading level={4} weight="heavy">
                        Time Range
                      </Heading>
                      <TimeRangeForm
                        initialValue={{ start, end }}
                        onSubmit={(timeRange) => {
                          onChange &&
                            onChange({
                              timeRangeKey: "custom",
                              ...timeRange,
                            });
                          close();
                        }}
                      />
                    </Flex>
                  )}
                </CustomTimeRangeWrap>
                <ListBox
                  aria-label="time range preset selection"
                  selectionMode="single"
                  autoFocus
                  selectedKeys={[timeRangeKey]}
                  css={listBoxCSS}
                  onSelectionChange={(selection) => {
                    if (selection === "all") {
                      close();
                      return;
                    }
                    const timeRangeKey = selection.keys().next().value;
                    if (!isTimeRangeKey(timeRangeKey)) {
                      close();
                      return;
                    }
                    if (timeRangeKey !== "custom") {
                      // Compute the time range
                      onChange({
                        timeRangeKey,
                        ...getTimeRangeFromLastNTimeRangeKey(timeRangeKey),
                      });
                      close();
                      return;
                    } else {
                      onChange({
                        timeRangeKey,
                        start: start,
                        end: end,
                      });
                    }
                  }}
                >
                  {LAST_N_TIME_RANGES.map(({ key, label }) => (
                    <ListBoxItem key={key} id={key}>
                      {label}
                    </ListBoxItem>
                  ))}
                  <ListBoxItem key="custom" id="custom">
                    Custom
                  </ListBoxItem>
                </ListBox>
              </Flex>
            </>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

function CustomTimeRangeWrap({
  children,
  visible,
}: PropsWithChildren<{ visible: boolean }>) {
  return (
    <div
      css={css`
        display: ${visible ? "block" : "none"};
      `}
    >
      <View
        borderEndWidth="thin"
        borderColor="light"
        padding="size-100"
        height="100%"
      >
        {children}
      </View>
    </div>
  );
}
