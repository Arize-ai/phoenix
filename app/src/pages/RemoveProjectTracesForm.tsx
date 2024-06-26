import React, { useCallback, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";
import { isValid as dateIsValid, parseISO } from "date-fns";

import { Button, Flex, Text, TextField, View } from "@arizeai/components";

import { RemoveProjectTracesFormMutation } from "./__generated__/RemoveProjectTracesFormMutation.graphql";

type RemoveProjectTracesFormProps = {
  projectId: string;
  onComplete: () => void;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type RemoveProjectTracesFormParams = {
  endDate: string;
};

export function RemoveProjectTracesForm(props: RemoveProjectTracesFormProps) {
  const { projectId } = props;
  const formRef = useRef<HTMLFormElement>(null);
  const [commit, isCommitting] = useMutation<RemoveProjectTracesFormMutation>(
    graphql`
      mutation RemoveProjectTracesFormMutation($input: ClearProjectInput!) {
        clearProject(input: $input) {
          __typename
        }
      }
    `
  );

  const {
    control,
    handleSubmit,
    setError,
    formState: { isValid },
  } = useForm({
    defaultValues: {
      // Need to remove the offset to be able to set the defaultValue
      endDate: new Date(Date.now() - ONE_DAY_MS).toISOString().slice(0, 16),
    } as RemoveProjectTracesFormParams,
  });

  const onSubmit = useCallback(
    (params: RemoveProjectTracesFormParams) => {
      // Validate date is a valid date
      const parsedDate = parseISO(params.endDate);
      if (!dateIsValid(parsedDate)) {
        return setError("endDate", {
          message: "Date is not in a valid format",
        });
      }

      commit({
        variables: {
          input: {
            id: projectId,
            endTime: new Date(parsedDate).toISOString(),
          },
        },
      });
      props.onComplete();
    },
    [commit, projectId, props, setError]
  );
  return (
    <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
      <View padding="size-200">
        <Text color="danger">
          {`You are about to remove traces up to the following date. This cannot be undone.`}
        </Text>
        <Controller
          name="endDate"
          control={control}
          rules={{
            required: "field is required",
          }}
          render={({
            field: { name, onChange, onBlur, value },
            fieldState: { invalid, error },
          }) => (
            <TextField
              label="End Date"
              type="datetime-local"
              name={name}
              description={`The date up to which you want to remove traces`}
              errorMessage={error?.message}
              validationState={invalid ? "invalid" : "valid"}
              onChange={onChange}
              onBlur={onBlur}
              defaultValue={value}
            />
          )}
        />
      </View>
      <View
        paddingEnd="size-200"
        paddingTop="size-100"
        paddingBottom="size-100"
        borderTopColor="light"
        borderTopWidth="thin"
      >
        <Flex direction="row" justifyContent="end">
          <Button
            type="submit"
            variant="danger"
            isDisabled={!isValid}
            size="compact"
            loading={isCommitting}
            onClick={() => {
              // TODO: This is a bit of a hack as the form is not working in a dialog for some reason
              // It probably has to do with the nested DOM structure under which it is being mounted
              formRef.current?.requestSubmit();
            }}
          >
            {isCommitting ? "Removing..." : "Remove Traces"}
          </Button>
        </Flex>
      </View>
    </form>
  );
}
