export type Study = {
  studyInstanceUID: string;
  studyId: string;
  patientName: string;
  studyDate: string;
  modality: string;
  seriesCount: number;
  instanceCount: number;
  thumbnailUrl?: string;
};

export type Series = {
  seriesInstanceUID: string;
  modality: string;
  instanceCount: number;
};

export type Instance = {
  sopInstanceUID: string;
  numberOfFrames: number;
  seriesInstanceUID?: string;
};

export type AnnotationClass = {
  id: string;
  name: string;
  color: string;
  visible: boolean;
};

export type AnnotationLayer = {
  id: string;
  tool: 'Rectangle' | 'Freehand' | 'Text' | 'Length' | 'Angle' | 'Ellipse' | 'Bidirectional';
  label: string;
  frameIndex: number;
  visible: boolean;
  bbox: [number, number, number, number];
  measurement?: string;
  classId: string;
};
