import React, { useCallback, useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { graphql, useLazyLoadQuery, useMutation } from "react-relay";
import { debounce } from "lodash";
import { css } from "@emotion/react";

import { Card } from "@arizeai/components";

import { Form, Input, Label, NumberField, Text } from "@phoenix/components";
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
          }
        }
      }
    `);

  const { control, handleSubmit, watch } = useForm({
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
        onCompleted: () => {
          notifySuccess({
            title: "Global retention policy updated",
            expireMs: 5000,
          });
        },
        onError: () => {
          notifyError({
            title: "Failed to update global retention policy",
            expireMs: 5000,
          });
        },
      });
    },
    [id, notifyError, notifySuccess, updateGlobalRetentionPolicy]
  );

  const debouncedSubmit = useMemo(() => {
    return debounce(onSubmit, 800);
  }, [onSubmit]);

  const maxDays = watch("maxDays");

  useEffect(() => {
    debouncedSubmit({ maxDays });
  }, [maxDays, debouncedSubmit]);

  return (
    <Card title="Global retention policy" variant="compact">
      <Form onSubmit={handleSubmit(onSubmit)}>
        <Controller
          control={control}
          name="maxDays"
          render={({ field }) => (
            <NumberField
              css={css`
                .react-aria-Input {
                  --input-width: 100px;
                  width: var(--input-width);
                  max-width: var(--input-width);
                  min-width: var(--input-width);
                }
              `}
              minValue={0}
              {...field}
            >
              <Label>Maximum Trace Retention in Days</Label>
              <Input />
              <Text slot="description">
                Maximum time, in days, that traces will be retained. Set to 0 to
                disable trace retention.
              </Text>
            </NumberField>
          )}
        />
      </Form>
    </Card>
  );
};
