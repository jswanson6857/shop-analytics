import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';

function LoginPage() {
  const { loginWithRedirect } = useAuth0();
  
  return (
    <div className="login-page">
      <div className="login-card">
        <h1>ReviveCRM</h1>
        <p className="tagline">Callback Management System</p>
        <button className="btn btn-primary" onClick={() => loginWithRedirect()}>
          Log In
        </button>
      </div>
    </div>
  );
}

export default LoginPage;
