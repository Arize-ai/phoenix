import { useCallback } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import { css } from "@emotion/react";

import { Card } from "@arizeai/components";

import {
  Button,
  FieldError,
  Flex,
  Form,
  Input,
  Label,
  Link,
  NumberField,
  Text,
  View,
} from "@phoenix/components";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { GlobalRetentionPolicyCardMutation } from "@phoenix/pages/settings/__generated__/GlobalRetentionPolicyCardMutation.graphql";
import { GlobalRetentionPolicyCardQuery } from "@phoenix/pages/settings/__generated__/GlobalRetentionPolicyCardQuery.graphql";

export const GlobalRetentionPolicyCard = () => {
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const data = useLazyLoadQuery<GlobalRetentionPolicyCardQuery>(
    graphql`
      query GlobalRetentionPolicyCardQuery {
        defaultProjectTraceRetentionPolicy {
          cronExpression
          id
          name
          rule {
            __typename
            ... on TraceRetentionRuleMaxDays {
              maxDays
            }
          }
        }
      }
    `,
    {}
  );
  const [updateGlobalRetentionPolicy] =
    useMutation<GlobalRetentionPolicyCardMutation>(graphql`
      mutation GlobalRetentionPolicyCardMutation(
        $input: PatchProjectTraceRetentionPolicyInput!
      ) {
        patchProjectTraceRetentionPolicy(input: $input) {
          node {
            id
            rule {
              __typename
              ... on TraceRetentionRuleMaxDays {
                maxDays
              }
            }
          }
        }
      }
    `);

  const {
    control,
    handleSubmit,
    formState: { isDirty },
    reset,
  } = useForm({
    defaultValues: {
      maxDays:
        data.defaultProjectTraceRetentionPolicy?.rule?.__typename ===
        "TraceRetentionRuleMaxDays"
          ? data.defaultProjectTraceRetentionPolicy.rule.maxDays
          : 0,
    },
  });

  const id = data.defaultProjectTraceRetentionPolicy?.id;
  const onSubmit = useCallback(
    (form: { maxDays: number }) => {
      updateGlobalRetentionPolicy({
        variables: {
          input: {
            id,
            rule: {
              maxDays: {
                maxDays: form.maxDays,
              },
            },
          },
        },
        onCompleted: (data) => {
          const maxDays =
            data.patchProjectTraceRetentionPolicy?.node?.rule?.__typename ===
            "TraceRetentionRuleMaxDays"
              ? data.patchProjectTraceRetentionPolicy.node.rule.maxDays
              : null;
          if (maxDays !== null) {
            // reset the form to the new maxDays value
            // this is a workaround to ensure the form is updated with the new value
            // our relay query is not revalidating correctly because defaultProjectTraceRetentionPolicy
            // is not a node with an id
            reset({
              maxDays,
            });
          }
          if (maxDays === 0) {
            notifySuccess({
              title: "Default retention policy disabled",
              expireMs: 5000,
            });
          } else {
            notifySuccess({
              title: `Default retention policy has been set to ${maxDays} ${
                maxDays === 1 ? "day" : "days"
              }`,
              expireMs: 5000,
            });
          }
        },
        onError: () => {
          notifyError({
            title: "Failed to update default retention policy",
            expireMs: 5000,
          });
        },
      });
    },
    [id, notifyError, notifySuccess, updateGlobalRetentionPolicy, reset]
  );

  return (
    <Card
      title="Default Project Retention Policy"
      variant="compact"
      bodyStyle={{
        padding: 0,
      }}
    >
      <View padding="size-200">
        <Flex direction="row" gap="size-200" justifyContent="space-between">
          <View paddingTop="size-100">
            <Text>
              The default retention policy for all projects that do not have
              their own custom retention policy. Traces that are older than the
              specified number of days will be deleted automatically in order to
              free up storage space.
            </Text>
          </View>
          <View width="1000px">
            <Form onSubmit={handleSubmit(onSubmit)}>
              <Flex gap="size-100" direction="row" alignItems="center">
                <Controller
                  control={control}
                  name="maxDays"
                  rules={{
                    validate: (value) => {
                      if (isNaN(value)) {
                        return "Maximum trace retention is required. Set to 0 to disable.";
                      }
                      return true;
                    },
                    min: {
                      value: 0,
                      message:
                        "Maximum trace retention must be at least 0 days",
                    },
                    required:
                      "Maximum trace retention is required. Set to 0 to disable.",
                  }}
                  render={({ field, fieldState }) => (
                    <NumberField
                      {...field}
                      minValue={0}
                      isInvalid={!!fieldState.error}
                    >
                      <Label>Maximum Trace Retention in Days</Label>
                      <Input />
                      {fieldState.error ? (
                        <FieldError>{fieldState.error?.message}</FieldError>
                      ) : (
                        <Text slot="description">
                          0 days is equal to no policy.
                        </Text>
                      )}
                    </NumberField>
                  )}
                />
                <div
                  css={css`
                    margin-top: 3px;
                  `}
                >
                  <Button type="submit" isDisabled={!isDirty}>
                    Update
                  </Button>
                </div>
              </Flex>
            </Form>
          </View>
        </Flex>
      </View>
      <View
        paddingX="size-200"
        paddingY="size-100"
        borderTopWidth="thin"
        borderColor="dark"
      >
        <Flex direction="row" justifyContent="end">
          <Link to="/settings/data">All Retention Policies</Link>
        </Flex>
      </View>
    </Card>
  );
};
