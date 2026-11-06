export type RenderGenerativeUIInput = {
  /**
   * Complete json-render flat spec describing the UI tree to render.
   * The root must identify one element in `elements`; each element declares its
   * component `type`, concrete `props`, and an empty `children` array for the
   * current chart-only catalog.
   */
  spec: Record<string, unknown>;
  /**
   * Optional initial json-render state model for specs that reference `$state`.
   * Most chart calls should put literal data directly in `spec.elements[id].props`
   * and omit this value, which the parser normalizes to an empty object.
   */
  state: Record<string, unknown>;
};
