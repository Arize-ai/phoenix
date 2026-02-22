import { Icon, Icons } from "@phoenix/components/icon";

export const FieldDangerIcon = () => {
  return (
    <Icon
      color="danger"
      className="field__icon"
      svg={<Icons.CloseCircleOutline />}
    />
  );
};
