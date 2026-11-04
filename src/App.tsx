import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { DeskPage } from './pages/Desk/DeskPage';
import { CollectionPage } from './pages/Collection/CollectionPage';
import { WorkshopPage } from './pages/Workshop/WorkshopPage';
import { GameSpacePage } from './pages/GameSpace/GameSpacePage';
import { ImportPage } from './pages/Import/ImportPage';
import { PromptsPage } from './pages/Prompts/PromptsPage';
import { ProtocolPage } from './pages/Protocol/ProtocolPage';
import { SettingsPage } from './pages/Settings/SettingsPage';

export const App: React.FC = () => {
  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<DeskPage />} />
          <Route path="/collection" element={<CollectionPage />} />
          <Route path="/workshop" element={<WorkshopPage />} />
          <Route path="/gamespace" element={<GameSpacePage />} />
          <Route path="/gamespace/:id" element={<GameSpacePage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/prompts" element={<PromptsPage />} />
          <Route path="/protocol" element={<ProtocolPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </HashRouter>
  );
};
export default App;
