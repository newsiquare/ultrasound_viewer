import type { AnnotationExportScope, Study } from '../types/dicom';

type Props = {
  study: Study | null;
  exportScope: AnnotationExportScope;
  onExportCoco: () => void;
};

export const TopPatientBar = ({ study, exportScope, onExportCoco }: Props): JSX.Element => {
  return (
    <header className="top-bar">
      <div>
        <p className="bar-label">Patient Name</p>
        <h1 className="bar-patient">{study?.patientName ?? 'No patient selected'}</h1>
      </div>
      <button className="btn-primary" type="button" onClick={onExportCoco}>
        COCO JSON export ({exportScope === 'current' ? 'Current' : 'All'})
      </button>
    </header>
  );
};
