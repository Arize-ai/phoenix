import { css } from "@emotion/react";
import { graphql, usePaginationFragment } from "react-relay";

import { Button, Card, Flex, Truncate, View } from "@phoenix/components";
import { EmptyState, EmptyStateGraphic } from "@phoenix/components/core/empty";
import { tableCSS } from "@phoenix/components/table/styles";
import { UserCell } from "@phoenix/components/table/UserCell";
import { useViewerCanModify } from "@phoenix/contexts/ViewerContext";
import { useTimeFormatters } from "@phoenix/hooks";

import type { SettingsAgentSessionsCard_sessions$key } from "./__generated__/SettingsAgentSessionsCard_sessions.graphql";
import type { SettingsAgentSessionsCardPaginationQuery } from "./__generated__/SettingsAgentSessionsCardPaginationQuery.graphql";
import { SettingsAgentSessionConditionalDeleteButton } from "./SettingsAgentSessionConditionalDeleteButton";
import { SETTINGS_AGENT_SESSIONS_PAGE_SIZE } from "./settingsAgentSessionConstants";

const sessionsTableWrapperCSS = css`
  overflow-x: auto;
`;

const sessionsTableCSS = css(
  tableCSS,
  css`
    table-layout: auto;

    thead {
      position: static;
    }

    .sessions-table__author {
      width: 16%;
    }

    .sessions-table__timestamp {
      width: 100px;
      min-width: 100px;
      max-width: 100px;
    }

    .sessions-table__content {
      width: 100%;
      min-width: 250px;
      max-width: 0;
    }

    .sessions-table__actions {
      position: sticky;
      right: 0;
      width: 48px;
      min-width: 48px;
      box-sizing: border-box;
      border-left: 1px solid var(--global-border-color-default);
      background-color: var(--global-table-pinned-column-background-color);
      z-index: 1;
    }

    th.sessions-table__actions {
      background-color: var(--global-table-header-background-color);
      z-index: 3;
    }
  `
);

export function SettingsAgentSessionsCard({
  query,
}: {
  query: SettingsAgentSessionsCard_sessions$key;
}) {
  const { data, loadNext, hasNext, isLoadingNext } = usePaginationFragment<
    SettingsAgentSessionsCardPaginationQuery,
    SettingsAgentSessionsCard_sessions$key
  >(
    graphql`
      fragment SettingsAgentSessionsCard_sessions on Query
      @refetchable(queryName: "SettingsAgentSessionsCardPaginationQuery")
      @argumentDefinitions(
        after: { type: "String", defaultValue: null }
        first: { type: "Int", defaultValue: 20 }
      ) {
        agentSessions(first: $first, after: $after)
          @connection(key: "SettingsAgentSessionsCard_agentSessions") {
          edges {
            node {
              id
              title
              user {
                username
                profilePictureUrl
              }
              firstInput
              createdAt
              updatedAt
            }
          }
        }
      }
    `,
    query
  );
  const { fullTimeFormatter } = useTimeFormatters();
  const canDeleteSessions = useViewerCanModify();
  const edges = data.agentSessions.edges;

  return (
    <Card title="Assistant sessions">
      {edges.length === 0 ? (
        <View padding="size-500">
          <EmptyState
            graphic={<EmptyStateGraphic variant="session" />}
            description="No saved assistant sessions"
          />
        </View>
      ) : (
        <div css={sessionsTableWrapperCSS}>
          <table css={sessionsTableCSS}>
            <thead>
              <tr>
                <th className="sessions-table__author">Author</th>
                <th>Content</th>
                <th className="sessions-table__timestamp">Created at</th>
                <th className="sessions-table__timestamp">Updated at</th>
                <th className="sessions-table__actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {edges.map(({ node }) => (
                <tr key={node.id}>
                  <td>
                    <UserCell user={node.user} />
                  </td>
                  <td className="sessions-table__content">
                    <Truncate
                      title={
                        node.firstInput
                          ? `${node.title} ${node.firstInput}`
                          : node.title
                      }
                    >
                      <strong>{node.title}</strong>
                      {node.firstInput ? ` ${node.firstInput}` : null}
                    </Truncate>
                  </td>
                  <td className="sessions-table__timestamp">
                    <time title={node.createdAt}>
                      {fullTimeFormatter(new Date(node.createdAt))}
                    </time>
                  </td>
                  <td className="sessions-table__timestamp">
                    <time title={node.updatedAt}>
                      {fullTimeFormatter(new Date(node.updatedAt))}
                    </time>
                  </td>
                  <td className="sessions-table__actions">
                    {canDeleteSessions ? (
                      <Flex justifyContent="end">
                        <SettingsAgentSessionConditionalDeleteButton
                          sessionId={node.id}
                          sessionTitle={node.title}
                        />
                      </Flex>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hasNext ? (
        <Flex
          justifyContent="end"
          css={css`
            padding: var(--global-dimension-size-100);
          `}
        >
          <Button
            size="S"
            onPress={() => loadNext(SETTINGS_AGENT_SESSIONS_PAGE_SIZE)}
            isDisabled={isLoadingNext}
          >
            {isLoadingNext ? "Loading..." : "Load more"}
          </Button>
        </Flex>
      ) : null}
    </Card>
  );
}
