import React from "react";
import { graphql, useMutation } from "react-relay";
import { useNavigate } from "react-router";

import { Button, Icon, Icons } from "@arizeai/components";

import { LogoutButtonMutation } from "./__generated__/LogoutButtonMutation.graphql";

export function LogoutButton() {
  const navigate = useNavigate();
  const [commit, isCommitting] = useMutation<LogoutButtonMutation>(graphql`
    mutation LogoutButtonMutation {
      logout
    }
  `);
  const onLogout = () => {
    commit({
      variables: {},
      onCompleted: () => {
        navigate("/login");
      },
    });
  };
  return (
    <Button
      onClick={onLogout}
      variant="default"
      size="compact"
      icon={<Icon svg={<Icons.LogOut />} />}
    >
      {isCommitting ? "Logging out..." : "Log out"}
    </Button>
  );
}
