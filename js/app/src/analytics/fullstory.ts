type FullStoryIdentity = {
  uid: string;
  displayName: string;
  email: string | null;
};

export function isFullStoryEnabled() {
  return "FS" in window;
}

function getUniqueUserId(userId: string) {
  // We prefix the user id with the basename to keep it unique

  if (window.Config.basename) {
    // Strip the leading and trailing slashes and replace slashes with dashes
    let prefix = window.Config.basename;
    prefix = prefix.replace(/^\/+|\/+$/g, "").replace(/\//g, "-");
    return `${prefix}-${userId}`;
  }

  return userId; // Fallback to the original user id if no basename is set
}

export function setIdentity(identity: FullStoryIdentity) {
  if (!isFullStoryEnabled()) {
    return;
  }

  try {
    // @ts-expect-error - FS is not typed, it's a global function
    FS("setIdentity", {
      uid: getUniqueUserId(identity.uid),
      properties: {
        displayName: identity.displayName,
        email: identity.email,
        // Add your own custom user variables here, details at
        // https://developer.fullstory.com/browser/identification/set-user-properties/
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error setting FullStory identity", error);
  }
}
