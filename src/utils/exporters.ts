import type {
  AnnotationClass,
  AnnotationExportRecord,
  AnnotationExportScope,
  Study,
} from '../types/dicom';

const downloadBlob = (filename: string, content: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const scopeLabel = (scope: AnnotationExportScope): string => (scope === 'current' ? 'current-study' : 'all-studies');

export const exportAnnotationJson = (
  classes: AnnotationClass[],
  records: AnnotationExportRecord[],
  studies: Study[],
  scope: AnnotationExportScope
): void => {
  const categories = classes.map((item, index) => ({
    id: index + 1,
    name: item.name,
    supercategory: 'ultrasound',
    color: item.color,
  }));
  const categoryIdMap = new Map(classes.map((item, index) => [item.id, index + 1]));

  downloadBlob(
    `annotations-${scopeLabel(scope)}-${new Date().toISOString()}.json`,
    JSON.stringify(
      {
        scope,
        exportedAt: new Date().toISOString(),
        categories,
        studies: studies.map((study) => ({
          studyInstanceUID: study.studyInstanceUID,
          patientName: study.patientName,
          studyDate: study.studyDate,
          studyId: study.studyId,
          modality: study.modality,
        })),
        annotations: records.map((record, index) => ({
          id: index + 1,
          annotation_uid: record.id,
          studyInstanceUID: record.studyInstanceUID,
          seriesInstanceUID: record.seriesInstanceUID,
          sopInstanceUID: record.sopInstanceUID,
          frameIndex: record.frameIndex,
          tool: record.tool,
          label: record.label,
          category_id: categoryIdMap.get(record.classId) ?? 0,
          category_name: record.className,
          category_color: record.classColor,
          visible: record.visible,
          bbox: record.bbox,
          measurement: record.measurement,
        })),
      },
      null,
      2
    ),
    'application/json'
  );
};

export const exportAnnotationCsv = (
  records: AnnotationExportRecord[],
  scope: AnnotationExportScope
): void => {
  const headers = [
    'id',
    'studyInstanceUID',
    'seriesInstanceUID',
    'sopInstanceUID',
    'frameIndex',
    'tool',
    'label',
    'classId',
    'className',
    'classColor',
    'visible',
    'bbox',
    'measurement',
  ];
  const rows = records.map((record) =>
    [
      record.id,
      record.studyInstanceUID,
      record.seriesInstanceUID,
      record.sopInstanceUID,
      String(record.frameIndex),
      record.tool,
      record.label,
      record.classId,
      record.className,
      record.classColor,
      String(record.visible),
      `"${record.bbox.join(',')}"`,
      record.measurement ?? '',
    ].join(',')
  );

  downloadBlob(
    `annotations-${scopeLabel(scope)}-${new Date().toISOString()}.csv`,
    [headers.join(','), ...rows].join('\n'),
    'text/csv;charset=utf-8;'
  );
};

export const exportCocoJson = (
  records: AnnotationExportRecord[],
  classes: AnnotationClass[],
  studies: Study[],
  scope: AnnotationExportScope
): void => {
  const categoryIdMap = new Map(classes.map((item, index) => [item.id, index + 1]));
  const imageIdMap = new Map<string, number>();
  const images: Array<Record<string, unknown>> = [];

  records.forEach((record) => {
    const imageKey = [
      record.studyInstanceUID,
      record.seriesInstanceUID,
      record.sopInstanceUID,
      record.frameIndex,
    ].join('|');
    if (imageIdMap.has(imageKey)) return;

    const imageId = imageIdMap.size + 1;
    imageIdMap.set(imageKey, imageId);

    const study = studies.find((item) => item.studyInstanceUID === record.studyInstanceUID);
    images.push({
      id: imageId,
      file_name: `${record.sopInstanceUID}-f${record.frameIndex + 1}.dcm`,
      width: Math.max(1, record.bbox[0] + record.bbox[2]),
      height: Math.max(1, record.bbox[1] + record.bbox[3]),
      study_instance_uid: record.studyInstanceUID,
      series_instance_uid: record.seriesInstanceUID,
      sop_instance_uid: record.sopInstanceUID,
      frame_index: record.frameIndex,
      patient_name: study?.patientName ?? '',
      study_date: study?.studyDate ?? '',
    });
  });

  const coco = {
    info: {
      description: 'Ultrasound DICOM Annotations',
      version: '1.0.0',
      date_created: new Date().toISOString(),
      scope,
    },
    images,
    annotations: records.map((record, index) => ({
      id: index + 1,
      image_id:
        imageIdMap.get(
          [
            record.studyInstanceUID,
            record.seriesInstanceUID,
            record.sopInstanceUID,
            record.frameIndex,
          ].join('|')
        ) ?? 0,
      category_id: categoryIdMap.get(record.classId) ?? 0,
      bbox: record.bbox,
      area: record.bbox[2] * record.bbox[3],
      iscrowd: 0,
      attributes: {
        annotation_uid: record.id,
        tool: record.tool,
        label: record.label,
        frameIndex: record.frameIndex,
        measurement: record.measurement ?? null,
        visible: record.visible,
        studyInstanceUID: record.studyInstanceUID,
        seriesInstanceUID: record.seriesInstanceUID,
        sopInstanceUID: record.sopInstanceUID,
      },
    })),
    categories: classes.map((item, index) => ({
      id: index + 1,
      name: item.name,
      color: item.color,
      supercategory: 'ultrasound',
    })),
  };

  downloadBlob(
    `coco-${scopeLabel(scope)}-${new Date().toISOString()}.json`,
    JSON.stringify(coco, null, 2),
    'application/json'
  );
};
