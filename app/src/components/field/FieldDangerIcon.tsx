import { Icon, Icons } from "@phoenix/components/icon";

export const FieldDangerIcon = () => {
  return (
    <Icon
      color="danger"
      className="ac-field-icon"
      svg={<Icons.CloseCircleOutline />}
    />
  );
};
