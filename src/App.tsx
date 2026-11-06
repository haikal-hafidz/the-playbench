import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { HostRouteGuard } from './components/layout/HostRouteGuard';
import { AppLoadingScreen } from './components/common/AppLoadingScreen';
import { RoleSelectionScreen } from './components/common/RoleSelectionScreen';
import { getUserRole, setUserRole, UserRole } from './services/storage/preferences';
import { DeskPage } from './pages/Desk/DeskPage';
import { CollectionPage } from './pages/Collection/CollectionPage';
import { WorkshopPage } from './pages/Workshop/WorkshopPage';
import { GameSpacePage } from './pages/GameSpace/GameSpacePage';
import { ImportPage } from './pages/Import/ImportPage';
import { PromptsPage } from './pages/Prompts/PromptsPage';
import { ProtocolPage } from './pages/Protocol/ProtocolPage';
import { SettingsPage } from './pages/Settings/SettingsPage';
import { HostSessionPage } from './pages/Multiplayer/HostSessionPage';
import { PlayerExperiencePage } from './pages/Player/PlayerExperiencePage';
import { gameRegistry } from './services/games/gameRegistry';

export const App: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(getUserRole());

  const initializeWorkbench = async () => {
    setIsInitializing(true);
    setInitError(null);
    try {
      // Initialize game registry and local storage stores
      await gameRegistry.init();
      setIsInitializing(false);
    } catch (err: any) {
      console.error('Initialization error:', err);
      setInitError(err.message || 'Failed to initialize workbench storage.');
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    initializeWorkbench();
  }, []);

  if (isInitializing) {
    return <AppLoadingScreen statusMessage="Initializing workbench and game registry..." />;
  }

  if (initError) {
    return (
      <AppLoadingScreen
        error={initError}
        onRetry={initializeWorkbench}
      />
    );
  }

  // Mandatory Role Selection Screen after loading completes
  if (!selectedRole) {
    return (
      <RoleSelectionScreen
        onSelectRole={(role) => {
          setUserRole(role);
          setSelectedRole(role);
          if (role === 'player') {
            window.location.hash = '#/play';
          } else {
            window.location.hash = '#/';
          }
        }}
      />
    );
  }

  return (
    <HashRouter>
      <AppShell>
        <Routes>
          {/* Landing route: Player goes to /play, Host goes to / */}
          <Route
            path="/"
            element={selectedRole === 'player' ? <Navigate to="/play" replace /> : <DeskPage />}
          />
          <Route path="/gamespace" element={<GameSpacePage />} />
          <Route path="/gamespace/:id" element={<GameSpacePage />} />
          <Route path="/protocol" element={<ProtocolPage />} />

          {/* Dedicated Player Experience */}
          <Route path="/play" element={<PlayerExperiencePage />} />
          <Route path="/play/:code" element={<PlayerExperiencePage />} />

          {/* Host Experience (Protected from Player role) */}
          <Route
            path="/host/session"
            element={
              <HostRouteGuard>
                <HostSessionPage />
              </HostRouteGuard>
            }
          />
          <Route
            path="/collection"
            element={
              <HostRouteGuard>
                <CollectionPage />
              </HostRouteGuard>
            }
          />
          <Route
            path="/workshop"
            element={
              <HostRouteGuard>
                <WorkshopPage />
              </HostRouteGuard>
            }
          />
          <Route
            path="/import"
            element={
              <HostRouteGuard>
                <ImportPage />
              </HostRouteGuard>
            }
          />
          <Route
            path="/prompts"
            element={
              <HostRouteGuard>
                <PromptsPage />
              </HostRouteGuard>
            }
          />
          <Route
            path="/settings"
            element={
              <HostRouteGuard>
                <SettingsPage />
              </HostRouteGuard>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </HashRouter>
  );
};
export default App;
