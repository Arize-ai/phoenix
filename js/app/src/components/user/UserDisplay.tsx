import type { CSSProperties } from "react";

import { Flex, Text, View } from "@phoenix/components";
import type { TextProps } from "@phoenix/components/core/content/Text";
import { Truncate } from "@phoenix/components/core/utility/Truncate";
import { UserPicture } from "@phoenix/components/user/UserPicture";

export interface UserDisplayUser {
  username: string;
  profilePictureUrl?: string | null;
}

export interface UserDisplayProps {
  /** The user to display. Null when the record has no attributed user. */
  user?: UserDisplayUser | null;
  /** Shown when there is no attributed user. */
  fallbackLabel?: string;
  /** The diameter of the profile picture. */
  profilePictureSize?: number;
  /** Constrains the display and truncates an overflowing username. */
  maxWidth?: CSSProperties["maxWidth"];
  /** The username text color. */
  color?: TextProps["color"];
}

/**
 * Displays a user's avatar and username. Records with no attributed user
 * (created before authentication, or via an API key) fall back to
 * `fallbackLabel`.
 */
export function UserDisplay({
  user,
  fallbackLabel = "system",
  profilePictureSize = 20,
  maxWidth,
  color,
}: UserDisplayProps) {
  const username = user?.username ?? fallbackLabel;

  return (
    <Flex
      direction="row"
      gap="size-100"
      alignItems="center"
      minWidth={0}
      maxWidth={maxWidth}
    >
      <UserPicture
        name={user?.username}
        profilePictureUrl={user?.profilePictureUrl}
        size={profilePictureSize}
      />
      <View minWidth={0} flex="0 1 auto">
        <Truncate maxWidth="100%" title={username}>
          <Text color={color}>{username}</Text>
        </Truncate>
      </View>
    </Flex>
  );
}
