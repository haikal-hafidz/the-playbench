import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LucideIcon, ArrowLeft, Construction, Clock } from 'lucide-react';
import { CuttingMat } from '../../components/desk/CuttingMat';

interface PlannedSectionViewProps {
  title: string;
  tagline: string;
  stage: string;
  targetRoadmap: string;
  icon: LucideIcon;
  plannedFeatures: string[];
  architecturalNote: string;
}

export const PlannedSectionView: React.FC<PlannedSectionViewProps> = ({
  title,
  tagline,
  stage,
  targetRoadmap,
  icon: Icon,
  plannedFeatures,
  architecturalNote,
}) => {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px 48px 20px' }}>
      <CuttingMat>
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: '#e8c872',
            fontSize: '13px',
            marginBottom: '18px',
            padding: '4px 10px',
            backgroundColor: 'rgba(0,0,0,0.25)',
            borderRadius: '4px',
          }}
        >
          <ArrowLeft size={14} />
          <span>Back to The Desk</span>
        </button>

        <div style={{
          backgroundColor: 'var(--color-paper-card)',
          borderRadius: '8px',
          border: '1px solid var(--color-paper-border)',
          boxShadow: 'var(--shadow-desk-card)',
          padding: '32px',
          color: 'var(--color-ink-primary)',
          position: 'relative',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid #d4c5a9', paddingBottom: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '8px',
                backgroundColor: '#1b4731',
                color: '#e8c872',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon size={26} />
              </div>
              <div>
                <h1 style={{ fontFamily: 'var(--font-family-display)', fontSize: '24px', fontWeight: 700, margin: 0 }}>
                  {title}
                </h1>
                <p style={{ fontSize: '13px', color: '#535c56', marginTop: '2px' }}>
                  {tagline}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontFamily: 'var(--font-family-craft)',
                backgroundColor: '#f3e8d2',
                color: '#735118',
                padding: '4px 8px',
                borderRadius: '4px',
                fontWeight: 600,
              }}>
                <Clock size={12} />
                <span>{stage}</span>
              </span>
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                fontFamily: 'var(--font-family-craft)',
                backgroundColor: '#e6dfd1',
                color: '#444d47',
                padding: '4px 8px',
                borderRadius: '4px',
              }}>
                <Construction size={12} />
                <span>{targetRoadmap}</span>
              </span>
            </div>
          </div>

          {/* Planned Features List */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '15px', fontFamily: 'var(--font-family-display)', marginBottom: '12px', color: '#1f2421' }}>
              Planned Capabilities (Under Active Development)
            </h3>
            <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#3f4742' }}>
              {plannedFeatures.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>

          {/* Architectural Notes */}
          <div style={{
            backgroundColor: '#f5efe1',
            border: '1px dashed #c4b595',
            padding: '16px 20px',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#4f5752',
            lineHeight: 1.5,
          }}>
            <strong style={{ color: '#1f2421' }}>Architectural Design Note: </strong>
            {architecturalNote}
          </div>
        </div>
      </CuttingMat>
    </div>
  );
};
