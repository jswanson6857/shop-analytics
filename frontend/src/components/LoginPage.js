// src/components/LoginButton.js
import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

const LoginButton = () => {
  const { loginWithRedirect } = useAuth0();

  return (
    <button
      className="auth-button login-button"
      onClick={() => loginWithRedirect()}
    >
      🔐 Log In
    </button>
  );
};

export default LoginButton;
