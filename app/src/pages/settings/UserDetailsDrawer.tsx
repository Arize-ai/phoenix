import { css } from "@emotion/react";
import { Suspense } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Navigate, useNavigate, useParams } from "react-router";
import invariant from "tiny-invariant";

import {
  Dialog,
  Drawer,
  Flex,
  Heading,
  Loading,
  Text,
  View,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components/core/dialog";
import { DRAWER_DEFAULT_MIN_SIZE } from "@phoenix/components/core/overlay/constants";
import { useDefaultDrawerSize } from "@phoenix/components/core/overlay/useDefaultDrawerSize";
import { UserPicture } from "@phoenix/components/user/UserPicture";
import { normalizeUserRole } from "@phoenix/constants";
import { useIsAuthenticatedAdmin } from "@phoenix/contexts";
import { AuthorizedApplicationsCard } from "@phoenix/pages/profile/AuthorizedApplicationsCard";
import type { UserDetailsDrawerQuery } from "@phoenix/pages/settings/__generated__/UserDetailsDrawerQuery.graphql";
import { UserAPIKeysCard } from "@phoenix/pages/settings/UserAPIKeysCard";

const userDetailsBodyCSS = css`
  overflow-y: auto;
  min-height: 0;
`;

const userDetailsGridCSS = css`
  list-style: none;
  margin: var(--global-dimension-size-200) 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--global-dimension-size-100);
`;

const userDetailsValueCSS = css`
  margin-top: var(--global-dimension-size-50);
`;

function UserDetailsContent({ userId }: { userId: string }) {
  const data = useLazyLoadQuery<UserDetailsDrawerQuery>(
    graphql`
      query UserDetailsDrawerQuery($userId: ID!) {
        node(id: $userId) {
          __typename
          ... on User {
            id
            username
            email
            authMethod
            createdAt
            profilePictureUrl
            role {
              name
            }
            ...UserAPIKeysCardFragment
            ...AuthorizedApplicationsCardFragment
          }
        }
      }
    `,
    { userId },
    { fetchPolicy: "store-and-network" }
  );
  const user = data.node;
  invariant(user.__typename === "User", "User is required");

  return (
    <Dialog aria-label={`User details for ${user.username}`}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>User details</DialogTitle>
          <DialogCloseButton slot="close" />
        </DialogHeader>
        <div css={userDetailsBodyCSS}>
          <View padding="size-200">
            <Flex direction="row" gap="size-100" alignItems="center">
              <UserPicture
                name={user.username}
                profilePictureUrl={user.profilePictureUrl}
                size={40}
              />
              <Flex direction="column" gap="size-25">
                <Heading level={2}>{user.username}</Heading>
                {user.email ? <Text size="S">{user.email}</Text> : null}
              </Flex>
            </Flex>
            <ul css={userDetailsGridCSS}>
              <li>
                <Text size="XS" color="text-700">
                  Role
                </Text>
                <div css={userDetailsValueCSS}>
                  <Text>{normalizeUserRole(user.role.name)}</Text>
                </div>
              </li>
              <li>
                <Text size="XS" color="text-700">
                  Authentication
                </Text>
                <div css={userDetailsValueCSS}>
                  <Text>{user.authMethod.toLowerCase()}</Text>
                </div>
              </li>
              <li>
                <Text size="XS" color="text-700">
                  Joined
                </Text>
                <div css={userDetailsValueCSS}>
                  <Text>{new Date(user.createdAt).toLocaleDateString()}</Text>
                </div>
              </li>
            </ul>
          </View>
          <View paddingX="size-200" paddingBottom="size-200">
            <Flex direction="column" gap="size-200">
              <UserAPIKeysCard user={user} userName={user.username} />
              <AuthorizedApplicationsCard
                viewer={user}
                userName={user.username}
              />
            </Flex>
          </View>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UserDetailsDrawer() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const isAdmin = useIsAuthenticatedAdmin();
  const { defaultSize, onSizeChange } = useDefaultDrawerSize({
    id: "settings-user-details",
  });
  invariant(userId, "userId is required");

  if (!isAdmin) {
    return <Navigate to="/settings/general" replace />;
  }

  return (
    <Drawer
      isOpen
      onClose={() => navigate("/settings/users")}
      defaultSize={defaultSize}
      minSize={DRAWER_DEFAULT_MIN_SIZE}
      onResize={onSizeChange}
    >
      <Suspense
        fallback={
          <View padding="size-400">
            <Loading />
          </View>
        }
      >
        <UserDetailsContent userId={userId} />
      </Suspense>
    </Drawer>
  );
}
