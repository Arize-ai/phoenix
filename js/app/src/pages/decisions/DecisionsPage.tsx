import { css } from "@emotion/react";
import { Suspense } from "react";
import { graphql, useLazyLoadQuery, usePaginationFragment } from "react-relay";
import { useSearchParams } from "react-router";

import {
  Button,
  DebouncedSearch,
  Flex,
  Icon,
  Icons,
  Link,
  LinkButton,
  Skeleton,
  Text,
  View,
} from "@phoenix/components";
import { CanModify } from "@phoenix/components/auth";
import {
  CompactEmptyState,
  EmptyState,
  EmptyStateArea,
  EmptyStateGraphic,
} from "@phoenix/components/core/empty";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { tableCSS } from "@phoenix/components/table/styles";
import { TagVersionLabel } from "@phoenix/pages/prompt/PromptVersionTagsList";

import type { DecisionsPage_list$key } from "./__generated__/DecisionsPage_list.graphql";
import type { DecisionsPagePaginationQuery } from "./__generated__/DecisionsPagePaginationQuery.graphql";
import type { DecisionsPageQuery } from "./__generated__/DecisionsPageQuery.graphql";
import { DeleteDecisionButton } from "./DecisionActions";

const pageCSS = css`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
`;

export function DecisionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  return (
    <div css={pageCSS}>
      <View
        padding="size-200"
        borderBottomWidth="thin"
        borderBottomColor="default"
        flex="none"
      >
        <Flex justifyContent="space-between" alignItems="center" gap="size-200">
          <DebouncedSearch
            aria-label="Search decisions by name"
            placeholder="Search decisions by name"
            defaultValue={search}
            onChange={(value) => {
              setSearchParams(
                (params) => {
                  if (value) params.set("search", value);
                  else params.delete("search");
                  return params;
                },
                { replace: true }
              );
            }}
          />
          <CanModify>
            <LinkButton
              to="/playground?newDecision=true"
              variant="primary"
              leadingVisual={<Icon svg={<Icons.Plus />} />}
            >
              New decision
            </LinkButton>
          </CanModify>
        </Flex>
      </View>
      <Suspense
        fallback={
          <View padding="size-200">
            <Skeleton height={200} />
          </View>
        }
      >
        <DecisionList search={search} />
      </Suspense>
    </div>
  );
}

function DecisionList({ search }: { search: string }) {
  const query = useLazyLoadQuery<DecisionsPageQuery>(
    graphql`
      query DecisionsPageQuery($filter: DecisionFilter) {
        ...DecisionsPage_list @arguments(filter: $filter)
      }
    `,
    { filter: search.trim() ? { col: "name", value: search.trim() } : null },
    { fetchPolicy: "store-and-network" }
  );
  return <DecisionsTable query={query} isFiltered={!!search.trim()} />;
}

function DecisionsTable({
  query,
  isFiltered,
}: {
  query: DecisionsPage_list$key;
  isFiltered: boolean;
}) {
  const { data, loadNext, hasNext, isLoadingNext, refetch } =
    usePaginationFragment<DecisionsPagePaginationQuery, DecisionsPage_list$key>(
      graphql`
        fragment DecisionsPage_list on Query
        @refetchable(queryName: "DecisionsPagePaginationQuery")
        @argumentDefinitions(
          first: { type: "Int", defaultValue: 50 }
          after: { type: "String" }
          filter: { type: "DecisionFilter" }
        ) {
          decisions(first: $first, after: $after, filter: $filter)
            @connection(key: "DecisionsPage_decisions") {
            edges {
              node {
                id
                name
                description
                updatedAt
                versionCount
                version {
                  id
                  modelName
                  modelProvider
                }
                versionTags {
                  id
                  name
                  decisionVersionId
                }
              }
            }
          }
        }
      `,
      query
    );

  if (data.decisions.edges.length === 0) {
    return (
      <EmptyStateArea>
        {isFiltered ? (
          <CompactEmptyState
            icon={<Icon svg={<Icons.Search />} />}
            description="No decisions"
            isFiltered
          />
        ) : (
          <EmptyState
            graphic={<EmptyStateGraphic variant="genericAdd" />}
            title="No decisions"
            description="Save typed questions and their model from the playground to create a versioned decision."
          />
        )}
      </EmptyStateArea>
    );
  }
  return (
    <div
      css={css`
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
      `}
    >
      <table css={tableCSS} aria-label="Saved decisions">
        <thead>
          <tr>
            {[
              "Name",
              "Description",
              "Model",
              "Versions",
              "Version tags",
              "Last updated",
              "Actions",
            ].map((heading) => (
              <th scope="col" key={heading}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.decisions.edges.map(({ node: decision }) => (
            <tr key={decision.id}>
              <td>
                <Link to={`/decisions/${decision.id}`}>{decision.name}</Link>
              </td>
              <td>
                <Text>{decision.description || "—"}</Text>
              </td>
              <td>
                {decision.version ? (
                  <Flex gap="size-100" alignItems="center">
                    <GenerativeProviderIcon
                      provider={decision.version.modelProvider}
                      height={16}
                    />
                    <Text>{decision.version.modelName}</Text>
                  </Flex>
                ) : (
                  "—"
                )}
              </td>
              <td>
                <Link to={`/decisions/${decision.id}/versions`}>
                  {decision.versionCount}
                </Link>
              </td>
              <td>
                <Flex gap="size-100" wrap>
                  {decision.versionTags.map((tag) => (
                    <Link
                      key={tag.id}
                      to={`/decisions/${decision.id}/versions/${tag.decisionVersionId}`}
                    >
                      <TagVersionLabel>{tag.name}</TagVersionLabel>
                    </Link>
                  ))}
                </Flex>
              </td>
              <td>
                <Text>{new Date(decision.updatedAt).toLocaleString()}</Text>
              </td>
              <td>
                <Flex gap="size-100" alignItems="center">
                  <LinkButton
                    size="S"
                    to={`/playground?decisionId=${encodeURIComponent(decision.id)}`}
                  >
                    Playground
                  </LinkButton>
                  <CanModify>
                    <DeleteDecisionButton
                      decisionId={decision.id}
                      name={decision.name}
                      onDeleted={() =>
                        refetch({}, { fetchPolicy: "network-only" })
                      }
                    />
                  </CanModify>
                </Flex>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasNext ? (
        <View padding="size-200">
          <Button onPress={() => loadNext(50)} isDisabled={isLoadingNext}>
            {isLoadingNext ? "Loading…" : "Load more decisions"}
          </Button>
        </View>
      ) : null}
    </div>
  );
}
