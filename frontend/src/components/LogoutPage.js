// src/components/LogoutButton.js
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

const LogoutButton = () => {
  const { logout, user } = useAuth0();

  return (
    <button
      className="auth-button logout-button"
      onClick={() =>
        logout({ logoutParams: { returnTo: window.location.origin } })
      }
      title={`Logged in as ${user?.email || "User"}`}
    >
      👤 {user?.email || "Logout"}
    </button>
  );
};

export default LogoutButton;
