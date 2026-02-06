import type { AnnotationClass, AnnotationLayer, Study } from '../types/dicom';

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

export const exportAnnotationJson = (classes: AnnotationClass[], layers: AnnotationLayer[]): void => {
  downloadBlob(
    `annotations-${new Date().toISOString()}.json`,
    JSON.stringify({ classes, layers }, null, 2),
    'application/json'
  );
};

export const exportAnnotationCsv = (layers: AnnotationLayer[]): void => {
  const headers = ['id', 'tool', 'label', 'frameIndex', 'visible', 'bbox', 'measurement', 'classId'];
  const rows = layers.map((layer) =>
    [
      layer.id,
      layer.tool,
      layer.label,
      String(layer.frameIndex),
      String(layer.visible),
      `"${layer.bbox.join(',')}"`,
      layer.measurement ?? '',
      layer.classId,
    ].join(',')
  );

  downloadBlob(
    `annotations-${new Date().toISOString()}.csv`,
    [headers.join(','), ...rows].join('\n'),
    'text/csv;charset=utf-8;'
  );
};

export const exportCocoJson = (study: Study | null, layers: AnnotationLayer[], classes: AnnotationClass[]): void => {
  const categoryIdMap = new Map(classes.map((item, index) => [item.id, index + 1]));

  const coco = {
    info: {
      description: 'Ultrasound DICOM Annotations',
      version: '1.0.0',
      date_created: new Date().toISOString(),
    },
    images: [
      {
        id: 1,
        file_name: `${study?.studyId ?? 'unknown-study'}.dcm`,
        width: 1024,
        height: 768,
        study_instance_uid: study?.studyInstanceUID ?? '',
      },
    ],
    annotations: layers.map((layer, index) => ({
      id: index + 1,
      image_id: 1,
      category_id: categoryIdMap.get(layer.classId) ?? 0,
      bbox: layer.bbox,
      area: layer.bbox[2] * layer.bbox[3],
      iscrowd: 0,
      attributes: {
        tool: layer.tool,
        label: layer.label,
        frameIndex: layer.frameIndex,
        measurement: layer.measurement ?? null,
      },
    })),
    categories: classes.map((item, index) => ({
      id: index + 1,
      name: item.name,
      color: item.color,
    })),
  };

  downloadBlob(
    `coco-${new Date().toISOString()}.json`,
    JSON.stringify(coco, null, 2),
    'application/json'
  );
};
