import { CalendarCell, CalendarGrid, Text } from "react-aria-components";

import { CalendarNavigation } from "./CalendarNavigation";

export type CalendarContentProps = {
  /** The number of side-by-side months to render. */
  months: number;
  /** An error message to display when the selection is invalid. */
  errorMessage?: string;
};

/**
 * The default composition shared by Calendar and RangeCalendar: month
 * navigation, one grid per visible month, and an optional error message.
 */
export function CalendarContent({
  months,
  errorMessage,
}: CalendarContentProps) {
  return (
    <>
      <CalendarNavigation />
      <div className="calendar__months">
        {Array.from({ length: months }, (_, i) => (
          <CalendarGrid key={i} offset={{ months: i }}>
            {(date) => <CalendarCell date={date} />}
          </CalendarGrid>
        ))}
      </div>
      {errorMessage && <Text slot="errorMessage">{errorMessage}</Text>}
    </>
  );
}
