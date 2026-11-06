import type * as Icons from "../icon/Icons";

export interface CopyActionMenuItem {
  name: string;
  value: string;
  iconKey?: keyof typeof Icons;
}
