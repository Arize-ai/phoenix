import { ComboBox, ComboBoxItem } from "@phoenix/components/combobox";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

const AWS_REGIONS = [
  { id: "us-east-1", label: "N. Virginia (us-east-1)" },
  { id: "us-east-2", label: "Ohio (us-east-2)" },
  { id: "us-west-1", label: "N. California (us-west-1)" },
  { id: "us-west-2", label: "Oregon (us-west-2)" },
  { id: "ap-south-1", label: "Asia Pacific (Mumbai) (ap-south-1)" },
  { id: "ap-northeast-3", label: "Asia Pacific (Osaka) (ap-northeast-3)" },
  { id: "ap-northeast-2", label: "Asia Pacific (Seoul) (ap-northeast-2)" },
  { id: "ap-southeast-1", label: "Asia Pacific (Singapore) (ap-southeast-1)" },
  { id: "ap-southeast-2", label: "Asia Pacific (Sydney) (ap-southeast-2)" },
  { id: "ap-east-2", label: "Asia Pacific (Taipei) (ap-east-2)" },
  { id: "ap-northeast-1", label: "Asia Pacific (Tokyo) (ap-northeast-1)" },
  { id: "ca-central-1", label: "Canada (Central) (ca-central-1)" },
  { id: "eu-central-1", label: "Europe (Frankfurt) (eu-central-1)" },
  { id: "eu-west-1", label: "Europe (Ireland) (eu-west-1)" },
  { id: "eu-west-2", label: "Europe (London) (eu-west-2)" },
  { id: "eu-west-3", label: "Europe (Paris) (eu-west-3)" },
  { id: "eu-north-1", label: "Europe (Stockholm) (eu-north-1)" },
  { id: "sa-east-1", label: "South America (São Paulo) (sa-east-1)" },
] as const;

export type AWSRegionConfigFormFieldProps = {
  /**
   * The playground instance ID to configure
   */
  playgroundInstanceId: number;
};

/**
 * Form field for configuring the AWS region for Bedrock.
 */
export function AWSRegionConfigFormField({
  playgroundInstanceId,
}: AWSRegionConfigFormFieldProps) {
  const instance = usePlaygroundContext((state) =>
    state.instances.find((instance) => instance.id === playgroundInstanceId)
  );
  const updateModel = usePlaygroundContext((state) => state.updateModel);

  if (!instance) {
    return null;
  }

  const handleRegionChange = (value: string) => {
    updateModel({
      instanceId: playgroundInstanceId,
      patch: {
        region: value,
      },
    });
  };

  return (
    <ComboBox
      size="L"
      label="Region"
      data-testid="bedrock-region-combobox"
      selectedKey={instance.model.region ?? "us-east-1"}
      aria-label="region picker"
      isRequired
      placeholder="Select an Amazon Region"
      inputValue={instance.model.region ?? "us-east-1"}
      onInputChange={handleRegionChange}
      onSelectionChange={(key) => {
        if (typeof key === "string") {
          handleRegionChange(key);
        }
      }}
      allowsCustomValue
    >
      {AWS_REGIONS.map((region) => (
        <ComboBoxItem key={region.id} textValue={region.id} id={region.id}>
          {region.label}
        </ComboBoxItem>
      ))}
    </ComboBox>
  );
}
