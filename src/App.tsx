import { useCallback, useEffect, useMemo, useState } from 'react';
import { SideNav } from './components/SideNav';
import { StudiesPanel } from './components/StudiesPanel';
import { TopPatientBar } from './components/TopPatientBar';
import { ViewerArea } from './components/ViewerArea';
import { AnnotationPanel } from './components/AnnotationPanel';
import { orthancClient } from './services/orthancDicomweb';
import { cacheWadorsMetadata } from './services/cornerstone';
import { useAppStore } from './store/useAppStore';
import { exportAnnotationCsv, exportAnnotationJson, exportCocoJson } from './utils/exporters';
import type { Series, Study } from './types/dicom';

const App = (): JSX.Element => {
  const {
    studies,
    loadingStudies,
    selectedStudy,
    imageIds,
    currentFrame,
    fps,
    isPlaying,
    activeTool,
    classes,
    layers,
    setStudies,
    setLoadingStudies,
    setSelectedStudy,
    setImageIds,
    setCurrentFrame,
    setFps,
    setIsPlaying,
    setActiveTool,
    toggleClassVisibility,
    toggleLayerVisibility,
    setAllClassVisibility,
    setAllLayerVisibility,
    deleteClass,
    deleteLayer,
    clearClasses,
    clearLayers,
  } = useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [modalityFilter, setModalityFilter] = useState('all');
  const [studiesError, setStudiesError] = useState<string | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [loadingViewer, setLoadingViewer] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let aborted = false;

    const run = async (): Promise<void> => {
      setLoadingStudies(true);
      setStudiesError(null);
      try {
        const rows = await orthancClient.searchStudies(searchTerm);
        if (!aborted) {
          setStudies(rows);
        }
      } catch (error) {
        console.error(error);
        if (!aborted) {
          setStudies([]);
          setStudiesError(orthancClient.getReadableError(error));
        }
      } finally {
        if (!aborted) {
          setLoadingStudies(false);
        }
      }
    };

    void run();

    return () => {
      aborted = true;
    };
  }, [searchTerm, refreshToken, setLoadingStudies, setStudies]);

  const filteredStudies = useMemo(() => {
    if (modalityFilter === 'all') return studies;
    return studies.filter((item) => item.modality.includes(modalityFilter));
  }, [studies, modalityFilter]);

  const retryStudies = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  const selectPreferredSeries = (series: Series[]): Series[] => {
    return [...series].sort((a, b) => b.instanceCount - a.instanceCount);
  };

  const handleSelectStudy = async (study: Study): Promise<void> => {
    setSelectedStudy(study);
    setImageIds([]);
    setViewerError(null);
    setLoadingViewer(true);
    setIsPlaying(false);

    try {
      const series = await orthancClient.getSeries(study.studyInstanceUID);
      if (!series.length) {
        setViewerError('No series found in this study.');
        return;
      }

      const prioritizedSeries = selectPreferredSeries(series);
      let loadedImageIds: string[] = [];

      for (const currentSeries of prioritizedSeries) {
        try {
          let entries = await orthancClient.getSeriesWadorsEntries(
            study.studyInstanceUID,
            currentSeries.seriesInstanceUID
          );

          if (!entries.length) {
            const metadataList = await orthancClient.getSeriesMetadata(
              study.studyInstanceUID,
              currentSeries.seriesInstanceUID
            );
            entries = orthancClient.buildWadorsEntriesFromMetadata(
              study.studyInstanceUID,
              currentSeries.seriesInstanceUID,
              metadataList
            );
          }

          if (entries.length > 0) {
            entries.forEach((entry) => {
              cacheWadorsMetadata(entry.imageId, entry.metadata);
            });
            loadedImageIds = entries.map((entry) => entry.imageId);
            break;
          }
        } catch (error) {
          console.warn('Failed to load series metadata', error);
        }
      }

      if (!loadedImageIds.length) {
        const entries = await orthancClient.getStudyWadorsEntries(study.studyInstanceUID);
        entries.forEach((entry) => {
          cacheWadorsMetadata(entry.imageId, entry.metadata);
        });
        loadedImageIds = entries.map((entry) => entry.imageId);
      }

      if (!loadedImageIds.length) {
        setViewerError('No displayable instances found in this study.');
        return;
      }

      setImageIds(loadedImageIds);
    } catch (error) {
      console.error(error);
      setImageIds([]);
      setViewerError(orthancClient.getReadableError(error));
    } finally {
      setLoadingViewer(false);
    }
  };

  return (
    <div className="app-root">
      <SideNav />

      <div className="app-main">
        <TopPatientBar
          study={selectedStudy}
          onExportCoco={() => exportCocoJson(selectedStudy, layers, classes)}
        />

        <div className="content-grid">
          <StudiesPanel
            studies={filteredStudies}
            baseUrl={orthancClient.getResolvedBaseUrl()}
            selectedStudyUid={selectedStudy?.studyInstanceUID}
            loading={loadingStudies}
            errorMessage={studiesError}
            searchTerm={searchTerm}
            modalityFilter={modalityFilter}
            onSearch={setSearchTerm}
            onFilter={setModalityFilter}
            onSelect={(study) => {
              void handleSelectStudy(study);
            }}
            onRetry={retryStudies}
          />

          <ViewerArea
            activeTool={activeTool}
            imageIds={imageIds}
            currentFrame={currentFrame}
            fps={fps}
            isPlaying={isPlaying}
            loading={loadingViewer}
            errorMessage={viewerError}
            selectedStudyName={selectedStudy?.patientName ?? null}
            layers={layers}
            onToolChange={setActiveTool}
            onFrameChange={setCurrentFrame}
            onFpsChange={setFps}
            onPlayingChange={setIsPlaying}
          />

          <AnnotationPanel
            classes={classes}
            layers={layers}
            onExportJson={() => exportAnnotationJson(classes, layers)}
            onExportCsv={() => exportAnnotationCsv(layers)}
            onToggleClassVisibility={toggleClassVisibility}
            onToggleLayerVisibility={toggleLayerVisibility}
            onSetAllClassesVisibility={setAllClassVisibility}
            onSetAllLayersVisibility={setAllLayerVisibility}
            onDeleteClass={deleteClass}
            onDeleteLayer={deleteLayer}
            onClearClasses={clearClasses}
            onClearLayers={clearLayers}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
