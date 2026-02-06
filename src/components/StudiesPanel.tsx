import { Loader2, Search } from 'lucide-react';
import type { Study } from '../types/dicom';

type Props = {
  studies: Study[];
  baseUrl: string;
  selectedStudyUid: string | undefined;
  loading: boolean;
  errorMessage: string | null;
  searchTerm: string;
  modalityFilter: string;
  onSearch: (value: string) => void;
  onFilter: (value: string) => void;
  onSelect: (study: Study) => void;
  onRetry: () => void;
};

export const StudiesPanel = ({
  studies,
  baseUrl,
  selectedStudyUid,
  loading,
  errorMessage,
  searchTerm,
  modalityFilter,
  onSearch,
  onFilter,
  onSelect,
  onRetry,
}: Props): JSX.Element => {
  return (
    <section className="studies-panel">
      <div className="panel-header">
        <h2>Studies</h2>
        <p>{studies.length} loaded</p>
      </div>
      <p className="panel-subtext">DICOMweb: {baseUrl}</p>

      <div className="search-wrap">
        <Search size={14} />
        <input
          type="text"
          placeholder="Search patient"
          value={searchTerm}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>

      <select value={modalityFilter} onChange={(event) => onFilter(event.target.value)}>
        <option value="all">All modalities</option>
        <option value="US">US</option>
        <option value="CT">CT</option>
        <option value="MR">MR</option>
      </select>

      <div className="study-list">
        {loading ? (
          <div className="loading-row">
            <Loader2 size={16} className="spin" />
            <span>Loading studies from Orthanc...</span>
          </div>
        ) : null}

        {!loading && errorMessage ? (
          <div className="error-row">
            <strong>Orthanc connection error</strong>
            <span>{errorMessage}</span>
            <button type="button" onClick={onRetry}>
              Retry
            </button>
          </div>
        ) : null}

        {!loading && !errorMessage && studies.length === 0 ? (
          <div className="empty-row">No studies found.</div>
        ) : null}

        {studies.map((study) => (
          <button
            type="button"
            key={study.studyInstanceUID}
            className={`study-card ${selectedStudyUid === study.studyInstanceUID ? 'selected' : ''}`}
            onClick={() => onSelect(study)}
          >
            <div className="thumb">128 x 128</div>
            <div className="study-meta">
              <p>
                <strong>Patient:</strong> {study.patientName}
              </p>
              <p>
                <strong>Date:</strong> {study.studyDate}
              </p>
              <p>
                <strong>Study ID:</strong> {study.studyId}
              </p>
              <p>
                <strong>Modality:</strong> {study.modality}
              </p>
              <p>
                <strong>Series:</strong> {study.seriesCount}
              </p>
              <p>
                <strong>Instances:</strong> {study.instanceCount}
              </p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};
