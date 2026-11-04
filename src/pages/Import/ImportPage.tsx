import React from 'react';
import { Upload } from 'lucide-react';
import { PlannedSectionView } from '../../components/common/PlannedSectionView';

export const ImportPage: React.FC = () => {
  return (
    <PlannedSectionView
      title="Import Center"
      tagline="Bring external games onto your bench via URL, JSON, or ZIP."
      stage="Planned"
      targetRoadmap="Stage 4"
      icon={Upload}
      plannedFeatures={[
        'ZIP Package Importer: Unpacks local archive, validates tpgp.json, and writes to IndexedDB.',
        'Remote URL Importer: Fetches hosted TPGP manifest with origin validation.',
        'JSON Manifest Inspector: Validates schema properties before installing.',
        'Path and security linting (blocks directory traversal and absolute paths).',
      ]}
      architecturalNote="JSON manifests are strictly treated as metadata configurations and never execute arbitrary eval code. External URLs are treated as untrusted."
    />
  );
};
