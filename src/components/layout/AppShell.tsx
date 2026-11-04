import React, { ReactNode } from 'react';
import { WorkbenchHeader } from './WorkbenchHeader';
import { WorkbenchFooter } from './WorkbenchFooter';

interface AppShellProps {
  children: ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="workbench-container">
      <WorkbenchHeader />
      <main style={{ flex: 1, position: 'relative' }}>
        {children}
      </main>
      <WorkbenchFooter />
    </div>
  );
};
