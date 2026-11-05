import React, { ReactNode } from 'react';
import { usePreferences } from '../../hooks/usePreferences';

interface CuttingMatProps {
  children: ReactNode;
}

export const CuttingMat: React.FC<CuttingMatProps> = ({ children }) => {
  const { preferences } = usePreferences();

  return (
    <div
      className={`cutting-mat theme-${preferences.cuttingMatTheme}`}
      style={{
        width: '100%',
        minHeight: '760px',
        position: 'relative',
        padding: preferences.showRulers ? '36px 32px 32px 36px' : '24px',
        boxSizing: 'border-box',
      }}
    >
      {/* Visual Subgrid */}
      <div className="cutting-mat-grid-layer" />
      <div className="cutting-mat-major-grid-layer" />

      {/* Angle Guide Lines (Illustrated craft aesthetic) */}
      <svg className="cutting-mat-angles" width="100%" height="100%">
        <line x1="0" y1="100%" x2="100%" y2="0" stroke="rgba(232, 200, 114, 0.25)" strokeWidth="1" strokeDasharray="6 4" />
        <line x1="0" y1="60%" x2="60%" y2="100%" stroke="rgba(232, 200, 114, 0.2)" strokeWidth="1" strokeDasharray="4 4" />
        <circle cx="50%" cy="50%" r="160" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" strokeDasharray="4 4" />
        <circle cx="50%" cy="50%" r="80" fill="none" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" />
      </svg>

      {/* Top ruler markings */}
      {preferences.showRulers && (
        <>
          <div className="mat-ruler-edge mat-ruler-top">
            <span>0</span><span>5</span><span>10</span><span>15</span><span>20</span><span>25</span>
            <span>30</span><span>35</span><span>40</span><span>45</span><span>50</span><span>55</span><span>60 cm</span>
          </div>
          <div className="mat-ruler-edge mat-ruler-left">
            <span>0</span><span>5</span><span>10</span><span>15</span><span>20</span><span>25</span><span>30</span><span>35 cm</span>
          </div>
        </>
      )}

      {/* Actual Content placed upon the mat */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        {children}
      </div>
    </div>
  );
};
