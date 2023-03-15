import { timeFormat } from "d3-time-format";

/**
 * Formats time to be displayed in full
 * e.x. in a tooltip
 */
export const fullTimeFormatter = timeFormat("%x %X");
