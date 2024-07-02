import React, { useCallback, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";
import { isValid as dateIsValid, parseISO } from "date-fns";

import { Button, Flex, Text, TextField, View } from "@arizeai/components";

import { ONE_MONTH_MS } from "@phoenix/constants/timeConstants";

import { RemoveProjectDataFormMutation } from "./__generated__/RemoveProjectDataFormMutation.graphql";

type RemoveProjectDataFormProps = {
  projectId: string;
  onComplete: () => void;
};

type RemoveProjectDataFormParams = {
  endDate: string;
};

export function RemoveProjectDataForm(props: RemoveProjectDataFormProps) {
  const { projectId } = props;
  const formRef = useRef<HTMLFormElement>(null);
  const [commit, isCommitting] = useMutation<RemoveProjectDataFormMutation>(
    graphql`
      mutation RemoveProjectDataFormMutation($input: ClearProjectInput!) {
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
      endDate: new Date(Date.now() - ONE_MONTH_MS).toISOString().slice(0, 16),
    } as RemoveProjectDataFormParams,
  });

  const onSubmit = useCallback(
    (params: RemoveProjectDataFormParams) => {
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
        onCompleted: () => {
          props.onComplete();
        },
        onError: (error) => {
          alert("Failed to clear project traces: " + error);
        },
      });
    },
    [commit, projectId, props, setError]
  );
  return (
    <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
      <View padding="size-200">
        <Text color="danger">
          {`You are about to remove all data before the following date. This cannot be undone.`}
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
              description={`The date up to which you want to remove data`}
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
            {isCommitting ? "Removing..." : "Remove Data"}
          </Button>
        </Flex>
      </View>
    </form>
  );
}
