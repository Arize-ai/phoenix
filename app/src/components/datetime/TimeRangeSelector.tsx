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
  Text,
  TimeRangeForm,
  View,
} from "@phoenix/components";
import { ComponentSize } from "@phoenix/components/types";
import { usePreferencesContext } from "@phoenix/contexts";
import { useTimeFormatters } from "@phoenix/hooks/useTimeFormatters";
import { getTimeZoneShortName } from "@phoenix/utils/timeFormatUtils";
import { getLocale, getTimeZone } from "@phoenix/utils/timeUtils";

import { LAST_N_TIME_RANGES } from "./constants";
import { OpenTimeRangeWithKey } from "./types";
import { getTimeRangeFromLastNTimeRangeKey, isTimeRangeKey } from "./utils";

export type TimeRangeSelectorProps = {
  isDisabled?: boolean;
  value: OpenTimeRangeWithKey;
  onChange: (timeRange: OpenTimeRangeWithKey) => void;
  size?: ComponentSize;
};

const listBoxCSS = css`
  width: 130px;
`;

export function TimeRangeSelector(props: TimeRangeSelectorProps) {
  const { value, isDisabled, onChange, size = "S" } = props;
  const { timeRangeKey, start, end } = value;
  const { timeRangeFormatter } = useTimeFormatters();
  const displayTimezone = usePreferencesContext(
    (state) => state.displayTimezone
  );
  /**
   * Get the display text for the time range key. Shows the explicit time range in the case of "custom"
   */
  const getDisplayText = ({
    timeRangeKey,
    start,
    end,
  }: OpenTimeRangeWithKey) => {
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
  };
  const hasDisplayTimeZone = displayTimezone !== undefined;
  const absoluteTimeZone = displayTimezone ?? getTimeZone();
  return (
    <DialogTrigger>
      <Button
        size={size}
        leadingVisual={<Icon svg={<Icons.CalendarOutline />} />}
        isDisabled={isDisabled}
      >
        <Flex direction="row" gap="size-100" alignItems="center">
          <>{getDisplayText(value)}</>
          {hasDisplayTimeZone && (
            <Text size="S" color="text-500">
              {getTimeZoneShortName({
                locale: getLocale(),
                timeZone: absoluteTimeZone,
              })}
            </Text>
          )}
        </Flex>
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
                    <Flex direction="column" gap="size-100" height="100%">
                      <Heading level={2} weight="heavy">
                        Time Range
                      </Heading>
                      <Text color="text-700" size="S">
                        {`Displayed in ${absoluteTimeZone} (${getTimeZoneShortName({ locale: getLocale(), timeZone: absoluteTimeZone })})`}
                      </Text>
                      <TimeRangeForm
                        initialValue={{ start, end }}
                        timeZone={displayTimezone}
                        onSubmit={(timeRange) => {
                          if (onChange) {
                            onChange({
                              timeRangeKey: "custom",
                              ...timeRange,
                            });
                          }
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
                      // Sometimes the time range is undefined for some reason
                      // TODO: figure out why this happens
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
        padding="size-200"
        height="100%"
      >
        {children}
      </View>
    </div>
  );
}
