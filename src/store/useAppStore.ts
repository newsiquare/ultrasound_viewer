import { create } from 'zustand';
import type { AnnotationClass, AnnotationLayer, Study } from '../types/dicom';
import type { ViewerTool } from '../types/tools';

type AppState = {
  studies: Study[];
  loadingStudies: boolean;
  selectedStudy: Study | null;
  imageIds: string[];
  currentFrame: number;
  fps: number;
  isPlaying: boolean;
  activeTool: ViewerTool;
  classes: AnnotationClass[];
  layers: AnnotationLayer[];
  selectedClassId: string;
  setSelectedClassId: (classId: string) => void;
  setLayers: (layers: AnnotationLayer[]) => void;
  setStudies: (studies: Study[]) => void;
  setStudyThumbnail: (studyInstanceUID: string, thumbnailUrl: string) => void;
  setLoadingStudies: (loading: boolean) => void;
  setSelectedStudy: (study: Study | null) => void;
  setImageIds: (imageIds: string[]) => void;
  setCurrentFrame: (frame: number) => void;
  setFps: (fps: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setActiveTool: (tool: ViewerTool) => void;
  toggleClassVisibility: (classId: string) => void;
  toggleLayerVisibility: (layerId: string) => void;
  setAllClassVisibility: (visible: boolean) => void;
  setAllLayerVisibility: (visible: boolean) => void;
  deleteClass: (classId: string) => void;
  deleteLayer: (layerId: string) => void;
  clearClasses: () => void;
  clearLayers: () => void;
};

const initialClasses: AnnotationClass[] = [
  { id: 'thrombus', name: 'thrombus', color: '#ff6b6b', visible: true },
  { id: 'plaque', name: 'plaque', color: '#4dabf7', visible: true },
  { id: 'calcification', name: 'calcification', color: '#ffd43b', visible: true },
];

export const useAppStore = create<AppState>((set) => ({
  studies: [],
  loadingStudies: false,
  selectedStudy: null,
  imageIds: [],
  currentFrame: 0,
  fps: 24,
  isPlaying: false,
  activeTool: 'Pan',
  classes: initialClasses,
  layers: [],
  selectedClassId: 'lesion',

  setSelectedClassId: (selectedClassId) => set({ selectedClassId }),
  setLayers: (layers) => set({ layers }),
  setStudies: (studies) => set({ studies }),
  setStudyThumbnail: (studyInstanceUID, thumbnailUrl) =>
    set((state) => ({
      studies: state.studies.map((study) =>
        study.studyInstanceUID === studyInstanceUID ? { ...study, thumbnailUrl } : study
      ),
    })),
  setLoadingStudies: (loadingStudies) => set({ loadingStudies }),
  setSelectedStudy: (selectedStudy) => set({ selectedStudy, currentFrame: 0, isPlaying: false }),
  setImageIds: (imageIds) => set({ imageIds, currentFrame: 0 }),
  setCurrentFrame: (currentFrame) => set({ currentFrame }),
  setFps: (fps) => set({ fps }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setActiveTool: (activeTool) => {
    if (activeTool === 'Reset') {
      return;
    }
    set({ activeTool });
  },
  toggleClassVisibility: (classId) =>
    set((state) => ({
      classes: state.classes.map((item) =>
        item.id === classId ? { ...item, visible: !item.visible } : item
      ),
    })),
  toggleLayerVisibility: (layerId) =>
    set((state) => ({
      layers: state.layers.map((item) =>
        item.id === layerId ? { ...item, visible: !item.visible } : item
      ),
    })),
  setAllClassVisibility: (visible) =>
    set((state) => ({
      classes: state.classes.map((item) => ({ ...item, visible })),
    })),
  setAllLayerVisibility: (visible) =>
    set((state) => ({
      layers: state.layers.map((item) => ({ ...item, visible })),
    })),
  deleteClass: (classId) =>
    set((state) => ({
      classes: state.classes.filter((item) => item.id !== classId),
      layers: state.layers.filter((layer) => layer.classId !== classId),
      selectedClassId:
        state.selectedClassId === classId
          ? state.classes.find((item) => item.id !== classId)?.id ?? ''
          : state.selectedClassId,
    })),
  deleteLayer: (layerId) =>
    set((state) => ({
      layers: state.layers.filter((item) => item.id !== layerId),
    })),
  clearClasses: () => set({ classes: [], layers: [], selectedClassId: '' }),
  clearLayers: () => set({ layers: [] }),
}));
