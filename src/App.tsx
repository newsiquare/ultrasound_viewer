import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SideNav } from './components/SideNav';
import { StudiesPanel } from './components/StudiesPanel';
import { TopPatientBar } from './components/TopPatientBar';
import { ViewerArea } from './components/ViewerArea';
import { AnnotationPanel } from './components/AnnotationPanel';
import { orthancClient } from './services/orthancDicomweb';
import {
  cacheWadorsMetadata,
  getAnnotationLayers,
  removeAllAnnotationLayers,
  removeAnnotationLayer,
  removeAnnotationLayersByStudy,
  setAnnotationLayerVisibility,
  subscribeToAnnotationChanges,
} from './services/cornerstone';
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
    setLayers,
    setStudies,
    setStudyThumbnail,
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
    clearClasses,
  } = useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [modalityFilter, setModalityFilter] = useState('all');
  const [studiesError, setStudiesError] = useState<string | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [loadingViewer, setLoadingViewer] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const thumbnailInFlightRef = useRef<Set<string>>(new Set());
  const thumbnailFailedRef = useRef<Set<string>>(new Set());
  const thumbnailBlobUrlRef = useRef<Map<string, string>>(new Map());
  const isUnmountedRef = useRef(false);

  useEffect(() => {
    let aborted = false;

    const run = async (): Promise<void> => {
      thumbnailBlobUrlRef.current.forEach((blobUrl) => {
        URL.revokeObjectURL(blobUrl);
      });
      thumbnailBlobUrlRef.current.clear();
      thumbnailInFlightRef.current.clear();
      thumbnailFailedRef.current.clear();
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

  useEffect(() => {
    if (!studies.length) return;

    const pending = studies.filter(
      (study) =>
        !study.thumbnailUrl &&
        !thumbnailInFlightRef.current.has(study.studyInstanceUID) &&
        !thumbnailFailedRef.current.has(study.studyInstanceUID)
    );

    if (!pending.length) return;

    let cursor = 0;
    const workerCount = Math.min(3, pending.length);

    const worker = async (): Promise<void> => {
      while (!isUnmountedRef.current) {
        const index = cursor;
        cursor += 1;
        if (index >= pending.length) {
          return;
        }

        const study = pending[index];
        thumbnailInFlightRef.current.add(study.studyInstanceUID);

        try {
          const thumbnailUrl = await orthancClient.getStudyThumbnailBlobUrl(study.studyInstanceUID);
          if (!thumbnailUrl) {
            thumbnailFailedRef.current.add(study.studyInstanceUID);
            continue;
          }

          if (isUnmountedRef.current) {
            URL.revokeObjectURL(thumbnailUrl);
            return;
          }

          const studyStillExists = useAppStore
            .getState()
            .studies.some((item) => item.studyInstanceUID === study.studyInstanceUID);
          if (!studyStillExists) {
            URL.revokeObjectURL(thumbnailUrl);
            continue;
          }

          const oldUrl = thumbnailBlobUrlRef.current.get(study.studyInstanceUID);
          if (oldUrl) {
            URL.revokeObjectURL(oldUrl);
          }
          thumbnailBlobUrlRef.current.set(study.studyInstanceUID, thumbnailUrl);
          setStudyThumbnail(study.studyInstanceUID, thumbnailUrl);
        } catch (error) {
          if (!isUnmountedRef.current) {
            thumbnailFailedRef.current.add(study.studyInstanceUID);
            console.warn('Thumbnail load failed', error);
          }
        } finally {
          thumbnailInFlightRef.current.delete(study.studyInstanceUID);
        }
      }
    };

    void Promise.all(Array.from({ length: workerCount }, () => worker()));
  }, [studies, setStudyThumbnail]);

  const syncLayersFromCornerstone = useCallback(() => {
    const state = useAppStore.getState();
    const classNamesById = Object.fromEntries(state.classes.map((item) => [item.id, item.name]));
    const defaultClassId = state.classes[0]?.id ?? 'unassigned';
    setLayers(getAnnotationLayers(classNamesById, defaultClassId, selectedStudy?.studyInstanceUID));
  }, [selectedStudy?.studyInstanceUID, setLayers]);

  useEffect(() => {
    const unsubscribe = subscribeToAnnotationChanges(() => {
      syncLayersFromCornerstone();
    });
    syncLayersFromCornerstone();
    return () => {
      unsubscribe();
    };
  }, [syncLayersFromCornerstone]);

  useEffect(() => {
    syncLayersFromCornerstone();
  }, [classes, syncLayersFromCornerstone]);

  useEffect(() => {
    const classVisibility = new Map(classes.map((item) => [item.id, item.visible]));
    layers.forEach((layer) => {
      const classVisible = classVisibility.get(layer.classId) ?? true;
      setAnnotationLayerVisibility(layer.id, layer.visible && classVisible);
    });
  }, [classes, layers]);

  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      thumbnailBlobUrlRef.current.forEach((blobUrl) => {
        URL.revokeObjectURL(blobUrl);
      });
      thumbnailBlobUrlRef.current.clear();
    };
  }, []);

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

  const handleDeleteLayer = useCallback((layerId: string) => {
    removeAnnotationLayer(layerId);
  }, []);

  const handleClearLayers = useCallback(() => {
    removeAnnotationLayersByStudy(selectedStudy?.studyInstanceUID);
  }, [selectedStudy?.studyInstanceUID]);

  const handleDeleteClass = useCallback(
    (classId: string) => {
      layers
        .filter((layer) => layer.classId === classId)
        .forEach((layer) => {
          removeAnnotationLayer(layer.id);
        });
      deleteClass(classId);
    },
    [deleteClass, layers]
  );

  const handleClearClasses = useCallback(() => {
    removeAllAnnotationLayers();
    clearClasses();
  }, [clearClasses]);

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
            onDeleteClass={handleDeleteClass}
            onDeleteLayer={handleDeleteLayer}
            onClearClasses={handleClearClasses}
            onClearLayers={handleClearLayers}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
