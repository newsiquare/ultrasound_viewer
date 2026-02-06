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
  setStudies: (studies: Study[]) => void;
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
  { id: 'lesion', name: 'Lesion', color: '#ff6b6b', visible: true },
  { id: 'vessel', name: 'Vessel', color: '#4dabf7', visible: true },
  { id: 'calcification', name: 'Calcification', color: '#ffd43b', visible: true },
];

const initialLayers: AnnotationLayer[] = [
  {
    id: 'layer-1',
    tool: 'Rectangle',
    label: 'Lesion ROI',
    frameIndex: 12,
    visible: true,
    bbox: [120, 90, 84, 61],
    measurement: '2.1 cm x 1.3 cm',
    classId: 'lesion',
  },
  {
    id: 'layer-2',
    tool: 'Length',
    label: 'Vessel Diameter',
    frameIndex: 14,
    visible: true,
    bbox: [228, 172, 44, 20],
    measurement: '4.2 mm',
    classId: 'vessel',
  },
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
  layers: initialLayers,
  selectedClassId: 'lesion',

  setStudies: (studies) => set({ studies }),
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
    })),
  deleteLayer: (layerId) =>
    set((state) => ({
      layers: state.layers.filter((item) => item.id !== layerId),
    })),
  clearClasses: () => set({ classes: [], layers: [] }),
  clearLayers: () => set({ layers: [] }),
}));
