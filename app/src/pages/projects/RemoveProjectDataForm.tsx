import { useCallback, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useMutation } from "react-relay";
import {
  getLocalTimeZone,
  parseAbsoluteToLocal,
} from "@internationalized/date";
import { isValid as dateIsValid } from "date-fns";
import { css } from "@emotion/react";

import {
  Button,
  DateField,
  DateInput,
  DateSegment,
  DateValue,
  FieldError,
  Flex,
  Icon,
  Icons,
  Label,
  Text,
  View,
} from "@phoenix/components";
import { ONE_MONTH_MS } from "@phoenix/constants/timeConstants";
import { useLocalTimeFormatPattern } from "@phoenix/hooks";

import { RemoveProjectDataFormMutation } from "./__generated__/RemoveProjectDataFormMutation.graphql";

type RemoveProjectDataFormProps = {
  projectId: string;
  onComplete: () => void;
};

type RemoveProjectDataFormParams = {
  endDate: DateValue;
};

export function RemoveProjectDataForm(props: RemoveProjectDataFormProps) {
  const { projectId } = props;
  const dateFormatPattern = useLocalTimeFormatPattern();
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
      endDate: parseAbsoluteToLocal(
        new Date(Date.now() - ONE_MONTH_MS).toISOString()
      ),
    } as RemoveProjectDataFormParams,
  });

  const onSubmit = useCallback(
    (params: RemoveProjectDataFormParams) => {
      // Validate date is a valid date
      const parsedDate = params.endDate.toDate(getLocalTimeZone());
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
          {` This will remove all data before the following date. This cannot be undone.`}
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
            <DateField
              isInvalid={invalid}
              onChange={onChange}
              name={name}
              onBlur={onBlur}
              value={value}
              granularity="second"
              hideTimeZone
              css={css`
                .react-aria-DateInput {
                  width: 100%;
                }
              `}
            >
              <Label>End Date</Label>
              <DateInput>
                {(segment) => <DateSegment segment={segment} />}
              </DateInput>
              {error ? (
                <FieldError>{error.message}</FieldError>
              ) : (
                <Text slot="description">
                  {`The date up to which you want to remove data. The format is ${dateFormatPattern}.`}
                </Text>
              )}
            </DateField>
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
            isDisabled={!isValid || isCommitting}
            size="S"
            leadingVisual={
              isCommitting ? <Icon svg={<Icons.LoadingOutline />} /> : undefined
            }
            onPress={() => {
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
