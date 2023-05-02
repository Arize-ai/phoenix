import { timeFormat } from "d3-time-format";

/**
 * Formats time to be displayed in full
 * e.x. in a tooltip
 */
export const fullTimeFormatter = timeFormat("%x %H:%M %p");

/**
 * Formats time to be displayed in short (no year or date)
 * e.x. in a tooltip
 */
export const shortTimeFormatter = timeFormat("%H:%M %p");
