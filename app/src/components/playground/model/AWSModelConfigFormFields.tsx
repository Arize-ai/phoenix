import { useCallback } from "react";

import { ComboBox, ComboBoxItem } from "@phoenix/components/combobox";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  PlaygroundInstance,
  PlaygroundNormalizedInstance,
} from "@phoenix/store";

export function AwsModelConfigFormFields({
  instance,
}: {
  instance: PlaygroundNormalizedInstance;
}) {
  const updateModel = usePlaygroundContext((state) => state.updateModel);
  const updateModelConfig = useCallback(
    ({
      configKey,
      value,
    }: {
      configKey: keyof PlaygroundInstance["model"];
      value: string;
    }) => {
      updateModel({
        instanceId: instance.id,
        patch: {
          ...instance.model,
          [configKey]: value,
        },
      });
    },
    [instance.id, instance.model, updateModel]
  );

  return (
    <>
      <ComboBox
        size="L"
        label="Region"
        data-testid="bedrock-region-combobox"
        selectedKey={instance.model.region ?? "us-east-1"}
        aria-label="region picker"
        isRequired
        placeholder="Select an Amazon Region"
        inputValue={instance.model.region ?? "us-east-1"}
        onInputChange={(value) => {
          updateModelConfig({
            configKey: "region",
            value,
          });
        }}
        onSelectionChange={(key) => {
          if (typeof key === "string") {
            updateModelConfig({
              configKey: "region",
              value: key,
            });
          }
        }}
        allowsCustomValue
      >
        <ComboBoxItem key="us-east-1" textValue="us-east-1" id="us-east-1">
          N. Virginia (us-east-1)
        </ComboBoxItem>
        <ComboBoxItem key="us-east-2" textValue="us-east-2" id="us-east-2">
          Ohio (us-east-2)
        </ComboBoxItem>
        <ComboBoxItem key="us-west-1" textValue="us-west-1" id="us-west-1">
          N. California (us-west-1)
        </ComboBoxItem>
        <ComboBoxItem key="us-west-2" textValue="us-west-2" id="us-west-2">
          Oregon (us-west-2)
        </ComboBoxItem>
        <ComboBoxItem key="ap-south-1" textValue="ap-south-1" id="ap-south-1">
          Asia Pacific (Mumbai) (ap-south-1)
        </ComboBoxItem>
        <ComboBoxItem
          key="ap-northeast-3"
          textValue="ap-northeast-3"
          id="ap-northeast-3"
        >
          Asia Pacific (Osaka) (ap-northeast-3)
        </ComboBoxItem>
        <ComboBoxItem
          key="ap-northeast-2"
          textValue="ap-northeast-2"
          id="ap-northeast-2"
        >
          Asia Pacific (Seoul) (ap-northeast-2)
        </ComboBoxItem>
        <ComboBoxItem
          key="ap-southeast-1"
          textValue="ap-southeast-1"
          id="ap-southeast-1"
        >
          Asia Pacific (Singapore) (ap-southeast-1)
        </ComboBoxItem>
        <ComboBoxItem
          key="ap-southeast-2"
          textValue="ap-southeast-2"
          id="ap-southeast-2"
        >
          Asia Pacific (Sydney) (ap-southeast-2)
        </ComboBoxItem>
        <ComboBoxItem key="ap-east-2" textValue="ap-east-2" id="ap-east-2">
          Asia Pacific (Taipei) (ap-east-2)
        </ComboBoxItem>
        <ComboBoxItem
          key="ap-northeast-1"
          textValue="ap-northeast-1"
          id="ap-northeast-1"
        >
          Asia Pacific (Tokyo) (ap-northeast-1)
        </ComboBoxItem>
        <ComboBoxItem
          key="ca-central-1"
          textValue="ca-central-1"
          id="ca-central-1"
        >
          Canada (Central) (ca-central-1)
        </ComboBoxItem>
        <ComboBoxItem
          key="eu-central-1"
          textValue="eu-central-1"
          id="eu-central-1"
        >
          Europe (Frankfurt) (eu-central-1)
        </ComboBoxItem>
        <ComboBoxItem key="eu-west-1" textValue="eu-west-1" id="eu-west-1">
          Europe (Ireland) (eu-west-1)
        </ComboBoxItem>
        <ComboBoxItem key="eu-west-2" textValue="eu-west-2" id="eu-west-2">
          Europe (London) (eu-west-2)
        </ComboBoxItem>
        <ComboBoxItem key="eu-west-3" textValue="eu-west-3" id="eu-west-3">
          Europe (Paris) (eu-west-3)
        </ComboBoxItem>
        <ComboBoxItem key="eu-north-1" textValue="eu-north-1" id="eu-north-1">
          Europe (Stockholm) (eu-north-1)
        </ComboBoxItem>
        <ComboBoxItem key="sa-east-1" textValue="sa-east-1" id="sa-east-1">
          South America (São Paulo) (sa-east-1)
        </ComboBoxItem>
      </ComboBox>
      <ComboBox
        size="L"
        label="API"
        data-testid="bedrock-api-combobox"
        selectedKey={instance.model.apiVersion ?? undefined}
        aria-label="api picker"
        isDisabled
        placeholder="Select an Bedrock API"
        inputValue={"converse"}
      >
        <ComboBoxItem key="converse" textValue="converse" id="converse">
          Converse
        </ComboBoxItem>
      </ComboBox>
    </>
  );
}
