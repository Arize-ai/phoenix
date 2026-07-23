import { css } from "@emotion/react";
import { graphql, usePaginationFragment } from "react-relay";

import { Button, Card, Flex, Truncate } from "@phoenix/components";
import { tableCSS } from "@phoenix/components/table/styles";
import { TableEmpty } from "@phoenix/components/table/TableEmpty";
import { UserCell } from "@phoenix/components/table/UserCell";
import { useViewerCanModify } from "@phoenix/contexts/ViewerContext";
import { useTimeFormatters } from "@phoenix/hooks";

import type { SettingsAgentSessionsCard_sessions$key } from "./__generated__/SettingsAgentSessionsCard_sessions.graphql";
import type { SettingsAgentSessionsCardPaginationQuery } from "./__generated__/SettingsAgentSessionsCardPaginationQuery.graphql";
import { SettingsAgentSessionActionMenu } from "./SettingsAgentSessionActionMenu";
import { SETTINGS_AGENT_SESSIONS_PAGE_SIZE } from "./settingsAgentSessionConstants";

const sessionsTableWrapperCSS = css`
  overflow-x: auto;
`;

const sessionsTableCSS = css(
  tableCSS,
  css`
    min-width: 900px;
    table-layout: fixed;

    thead {
      position: static;
    }

    .sessions-table__author,
    .sessions-table__title {
      width: 16%;
    }

    .sessions-table__preview {
      width: 21%;
    }

    .sessions-table__timestamp {
      width: 13%;
    }

    th:last-of-type {
      width: 48px;
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
              ...EditAgentSessionTitleDialog_session
              user {
                username
                profilePictureUrl
              }
              firstInput
              latestOutput
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
  const shouldShowAuthor = window.Config.authenticationEnabled;
  const edges = data.agentSessions.edges;

  return (
    <Card title="Assistant sessions" collapsible defaultOpen={false}>
      <div css={sessionsTableWrapperCSS}>
        <table css={sessionsTableCSS}>
          <thead>
            <tr>
              {shouldShowAuthor ? (
                <th className="sessions-table__author">Author</th>
              ) : null}
              <th className="sessions-table__title">Title</th>
              <th className="sessions-table__preview">First session input</th>
              <th className="sessions-table__preview">Latest session output</th>
              <th className="sessions-table__timestamp">Created at</th>
              <th className="sessions-table__timestamp">Updated at</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          {edges.length === 0 ? (
            <TableEmpty message="No saved assistant sessions" />
          ) : (
            <tbody>
              {edges.map(({ node }) => (
                <tr key={node.id}>
                  {shouldShowAuthor ? (
                    <td>
                      <UserCell user={node.user} />
                    </td>
                  ) : null}
                  <td>
                    <Truncate title={node.title}>{node.title}</Truncate>
                  </td>
                  <td>
                    <Truncate title={node.firstInput ?? undefined}>
                      {node.firstInput ?? "--"}
                    </Truncate>
                  </td>
                  <td>
                    <Truncate title={node.latestOutput ?? undefined}>
                      {node.latestOutput ?? "--"}
                    </Truncate>
                  </td>
                  <td>
                    <time title={node.createdAt}>
                      {fullTimeFormatter(new Date(node.createdAt))}
                    </time>
                  </td>
                  <td>
                    <time title={node.updatedAt}>
                      {fullTimeFormatter(new Date(node.updatedAt))}
                    </time>
                  </td>
                  <td>
                    {canDeleteSessions ? (
                      <Flex justifyContent="end">
                        <SettingsAgentSessionActionMenu
                          sessionId={node.id}
                          sessionTitle={node.title}
                          session={node}
                        />
                      </Flex>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
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
