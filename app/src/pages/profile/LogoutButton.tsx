import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router";

import { Button, Icon, Icons } from "@arizeai/components";

export function LogoutButton() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const onLogout = useCallback(async () => {
    setIsLoading(() => true);
    try {
      const response = await fetch("/auth/logout", {
        method: "POST",
      });
      if (response.ok) {
        navigate("/login");
      }
    } finally {
      setIsLoading(() => false);
    }
  }, [navigate]);
  return (
    <Button
      onClick={onLogout}
      variant="default"
      size="compact"
      icon={<Icon svg={<Icons.LogOut />} />}
    >
      {isLoading ? "Logging out..." : "Log out"}
    </Button>
  );
}
