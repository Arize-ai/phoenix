import { css } from "@emotion/react";

import {
  Button,
  Flex,
  Icon,
  Icons,
  Input,
  Label,
  TextField,
  View,
} from "@phoenix/components";
import { BaseToolEditorProps } from "@phoenix/pages/playground/PlaygroundTool";

type CategoricalChoiceToolProps = BaseToolEditorProps;

export const CategoricalChoiceTool = ({
  playgroundInstanceId,
  tool,
  toolDefinitionJSONSchema,
  updateTool,
}: CategoricalChoiceToolProps) => {
  // derive an openai tool definition from the definition stored in the tool
  // futhermore, refine the definition to be a categorical choice tool definition
  // we need to figure out what happens when the user changes the tool type from json to categorical choice
  // going from categorical choice to json should be a no-op
  // - when the user edits the form, we need to update the tool definition
  //   how do we edit the original tool definition when the provider may not be openai?
  //   do we need to pull the current definition, convert to openai, edit, and then convert back?
  //   that sounds expensive
  //
  //   the other option is to have an internal choice state that is used to render the form
  //   and when that stat changes, we debounce the update to the tool definition
  //   just creating a new openai tool definition and then converting to the target provider
  //
  //   a third option is to best effort parse the expected properties from the tool definition for
  //   the form, and then display an error alert containing the rest of the invalid properties or
  //   the original definition if the parsing fails
  return (
    <View padding="size-200">
      <Flex direction="column" gap="size-100">
        <TextField>
          <Label>Name</Label>
          <Input placeholder="e.g. correctness" />
        </TextField>
        <Flex gap="size-100">
          <TextField>
            <Label>Label</Label>
            <Input placeholder="e.g. correct" />
          </TextField>
          <TextField>
            <Label>Description</Label>
            <Input />
          </TextField>
        </Flex>
        <Button
          variant="quiet"
          css={css`
            width: fit-content;
          `}
          leadingVisual={<Icon svg={<Icons.PlusOutline />} />}
        >
          Add Choice
        </Button>
      </Flex>
    </View>
  );
};
