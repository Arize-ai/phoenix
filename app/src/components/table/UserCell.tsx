import { Flex, Text } from "@phoenix/components";
import { UserPicture } from "@phoenix/components/user/UserPicture";

export interface UserCellUser {
  username: string;
  profilePictureUrl?: string | null;
}

export interface UserCellProps {
  /** The user to display. Null when the record has no attributed user. */
  user?: UserCellUser | null;
  /** Shown when there is no attributed user. */
  fallbackLabel?: string;
}

/**
 * A table cell displaying a user's avatar and username. Records with no
 * attributed user (created before authentication, or via an API key) fall back
 * to `fallbackLabel`.
 */
export function UserCell({ user, fallbackLabel = "system" }: UserCellProps) {
  return (
    <Flex direction="row" gap="size-100" alignItems="center">
      <UserPicture
        name={user?.username}
        profilePictureUrl={user?.profilePictureUrl}
        size={20}
      />
      <Text>{user?.username ?? fallbackLabel}</Text>
    </Flex>
  );
}
