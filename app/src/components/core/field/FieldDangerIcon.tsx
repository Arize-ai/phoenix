import { Icon, Icons } from "@phoenix/components/core/icon";

export const FieldDangerIcon = () => {
  return (
    <Icon
      color="danger"
      className="field__icon"
      svg={<Icons.CloseCircleOutline />}
    />
  );
};
