import React, { useState } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import FollowUpBoard from './components/FollowUpBoard';
import FollowUpTracker from './components/FollowUpTracker';
import AppointmentTracker from './components/AppointmentTracker';
import ReturnSalesTracker from './components/ReturnSalesTracker';
import LoginPage from './components/LoginPage';
import LogoutPage from './components/LogoutPage';
import './App.css';

function AppContent() {
  const { isLoading, isAuthenticated, user } = useAuth0();
  const [currentView, setCurrentView] = useState('board');
  
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <LoginPage />;
  }
  
  return (
    <div className="app">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>ReviveCRM</h2>
          <p className="tagline">Callback Management</p>
        </div>
        
        <nav className="sidebar-nav">
          <button
            className={`nav-button ${currentView === 'board' ? 'active' : ''}`}
            onClick={() => setCurrentView('board')}
          >
            <span className="nav-icon">📋</span>
            <span className="nav-text">Follow Up Board</span>
          </button>
          
          <button
            className={`nav-button ${currentView === 'tracker' ? 'active' : ''}`}
            onClick={() => setCurrentView('tracker')}
          >
            <span className="nav-icon">📞</span>
            <span className="nav-text">Follow Up Tracker</span>
          </button>
          
          <button
            className={`nav-button ${currentView === 'appointments' ? 'active' : ''}`}
            onClick={() => setCurrentView('appointments')}
          >
            <span className="nav-icon">📅</span>
            <span className="nav-text">Appointment Tracker</span>
          </button>
          
          <button
            className={`nav-button ${currentView === 'sales' ? 'active' : ''}`}
            onClick={() => setCurrentView('sales')}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-text">Return Sales Tracker</span>
          </button>
        </nav>
        
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="user-details">
              <div className="user-name">{user?.name || 'User'}</div>
              <div className="user-email">{user?.email}</div>
            </div>
          </div>
          <LogoutPage />
        </div>
      </div>
      
      {/* Main Content */}
      <div className="main-content">
        {currentView === 'board' && <FollowUpBoard />}
        {currentView === 'tracker' && <FollowUpTracker />}
        {currentView === 'appointments' && <AppointmentTracker />}
        {currentView === 'sales' && <ReturnSalesTracker />}
      </div>
    </div>
  );
}

function App() {
  return (
    <Auth0Provider
      domain={process.env.REACT_APP_AUTH0_DOMAIN || 'dev-fugvz4vli76oqpqw.us.auth0.com'}
      clientId={process.env.REACT_APP_AUTH0_CLIENT_ID || '8OMklLM4zv5GsVZ8laNPOZK97IDDxoQP'}
      redirectUri={window.location.origin}
    >
      <AppContent />
    </Auth0Provider>
  );
}

export default App;
