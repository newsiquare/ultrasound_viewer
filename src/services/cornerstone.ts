import {
  Enums,
  RenderingEngine,
  eventTarget,
  init as initCornerstoneCore,
  getRenderingEngine,
  type Types,
} from '@cornerstonejs/core';
import dicomImageLoader from '@cornerstonejs/dicom-image-loader';
import {
  AngleTool,
  ArrowAnnotateTool,
  BidirectionalTool,
  EllipticalROITool,
  Enums as csToolsEnums,
  LengthTool,
  PanTool,
  PlanarFreehandROITool,
  RectangleROITool,
  ToolGroupManager,
  WindowLevelTool,
  ZoomTool,
  addTool,
  annotation as csToolsAnnotation,
  init as initCornerstoneTools,
} from '@cornerstonejs/tools';
import type { AnnotationLayer } from '../types/dicom';
import type { ViewerTool } from '../types/tools';

type CornerstoneGlobalState = typeof globalThis & {
  __sono_cornerstone_initialized__?: boolean;
  __sono_cornerstone_init_promise__?: Promise<void>;
  __sono_cornerstone_tools_initialized__?: boolean;
};

const cornerstoneGlobal = globalThis as CornerstoneGlobalState;

let initialized = Boolean(cornerstoneGlobal.__sono_cornerstone_initialized__);
let toolsInitialized = Boolean(cornerstoneGlobal.__sono_cornerstone_tools_initialized__);

export const VIEWPORT_ID = 'dicom-viewport';
export const RENDERING_ENGINE_ID = 'dicom-rendering-engine';
export const TOOL_GROUP_ID = 'dicom-tool-group';

const TOOL_CLASSES = [
  PanTool,
  ZoomTool,
  WindowLevelTool,
  RectangleROITool,
  PlanarFreehandROITool,
  ArrowAnnotateTool,
  LengthTool,
  AngleTool,
  EllipticalROITool,
  BidirectionalTool,
];

const SUPPORTED_TOOL_NAMES = TOOL_CLASSES.map((ToolClass) => ToolClass.toolName);

const TOOL_NAME_TO_LAYER_TOOL = new Map<string, AnnotationLayer['tool']>([
  [RectangleROITool.toolName, 'Rectangle'],
  [PlanarFreehandROITool.toolName, 'Freehand'],
  [ArrowAnnotateTool.toolName, 'Text'],
  [LengthTool.toolName, 'Length'],
  [AngleTool.toolName, 'Angle'],
  [EllipticalROITool.toolName, 'Ellipse'],
  [BidirectionalTool.toolName, 'Bidirectional'],
]);

const VIEWER_TOOL_TO_CS_TOOL: Partial<Record<ViewerTool, string>> = {
  Pan: PanTool.toolName,
  Zoom: ZoomTool.toolName,
  'W/L': WindowLevelTool.toolName,
  'Annotate-Rect': RectangleROITool.toolName,
  'Annotate-Freehand': PlanarFreehandROITool.toolName,
  'Annotate-Text': ArrowAnnotateTool.toolName,
  'Measure-Length': LengthTool.toolName,
  'Measure-Angle': AngleTool.toolName,
  'Measure-Rect': RectangleROITool.toolName,
  'Measure-Ellipse': EllipticalROITool.toolName,
  'Measure-Bidirectional': BidirectionalTool.toolName,
};

const ACTIVE_BINDING = [{ mouseButton: csToolsEnums.MouseBindings.Primary }];

const roundTo = (value: number, digits = 2): number => {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
};

const parseFrameIndex = (referencedImageId?: string): number => {
  if (!referencedImageId) return 0;
  const match = referencedImageId.match(/\/frames\/(\d+)/i);
  if (!match) return 0;
  const frame = Number(match[1]);
  if (!Number.isFinite(frame) || frame <= 0) return 0;
  return frame - 1;
};

const extractMeasurement = (cachedStatsValue: unknown): string | undefined => {
  if (!cachedStatsValue || typeof cachedStatsValue !== 'object') return undefined;
  const cachedStats = cachedStatsValue as Record<string, unknown>;
  const statsEntry = Object.values(cachedStats).find(
    (value) => value && typeof value === 'object'
  ) as Record<string, unknown> | undefined;
  if (!statsEntry) return undefined;

  const metric = (key: string): number | undefined => {
    const value = statsEntry[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  };
  const unit = (key: string): string => {
    const value = statsEntry[key];
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  };

  const length = metric('length');
  if (length !== undefined) {
    return `${roundTo(length)} ${unit('unit') || 'mm'}`.trim();
  }

  const width = metric('width');
  if (width !== undefined) {
    return `${roundTo(width)} ${unit('widthUnit') || unit('unit') || 'mm'}`.trim();
  }

  const angle = metric('angle');
  if (angle !== undefined) {
    return `${roundTo(angle)} deg`;
  }

  const area = metric('area');
  if (area !== undefined) {
    return `${roundTo(area)} ${unit('areaUnit') || 'mm2'}`.trim();
  }

  return undefined;
};

const getAnnotationBoundingBox = (annotation: unknown): [number, number, number, number] => {
  const renderingEngine = getRenderingEngine(RENDERING_ENGINE_ID);
  const viewport = renderingEngine?.getViewport(VIEWPORT_ID) as Types.IStackViewport | undefined;
  if (!viewport) return [0, 0, 0, 0];

  const points = (annotation as { data?: { handles?: { points?: Types.Point3[] } } })?.data?.handles
    ?.points;
  if (!Array.isArray(points) || points.length === 0) {
    return [0, 0, 0, 0];
  }

  const canvasPoints = points.map((point) => viewport.worldToCanvas(point));
  const xs = canvasPoints.map((point) => point[0]);
  const ys = canvasPoints.map((point) => point[1]);

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return [
    Math.round(minX),
    Math.round(minY),
    Math.round(maxX - minX),
    Math.round(maxY - minY),
  ];
};

const renderViewport = (): void => {
  const renderingEngine = getRenderingEngine(RENDERING_ENGINE_ID);
  if (!renderingEngine) return;
  const viewport = renderingEngine.getViewport(VIEWPORT_ID) as Types.IStackViewport | undefined;
  viewport?.render();
};

const registerTools = (): void => {
  TOOL_CLASSES.forEach((ToolClass) => {
    try {
      addTool(ToolClass);
    } catch {
      // Tool might already be registered during HMR re-load.
    }
  });
};

const ensureToolGroup = (): void => {
  let toolGroup = ToolGroupManager.getToolGroup(TOOL_GROUP_ID);
  if (!toolGroup) {
    toolGroup = ToolGroupManager.createToolGroup(TOOL_GROUP_ID);
    if (!toolGroup) {
      throw new Error(`Unable to create cornerstone tool group: ${TOOL_GROUP_ID}`);
    }
    const createdToolGroup = toolGroup;
    SUPPORTED_TOOL_NAMES.forEach((toolName) => {
      createdToolGroup.addTool(toolName);
    });
    createdToolGroup.setToolActive(PanTool.toolName, { bindings: ACTIVE_BINDING });
    SUPPORTED_TOOL_NAMES.filter((toolName) => toolName !== PanTool.toolName).forEach((toolName) => {
      createdToolGroup.setToolPassive(toolName, { removeAllBindings: true });
    });
  }

  if (!toolGroup.getViewportIds().includes(VIEWPORT_ID)) {
    toolGroup.addViewport(VIEWPORT_ID, RENDERING_ENGINE_ID);
  }
};

export const initializeCornerstone = async (): Promise<void> => {
  if (initialized) return;
  if (cornerstoneGlobal.__sono_cornerstone_init_promise__) {
    await cornerstoneGlobal.__sono_cornerstone_init_promise__;
    return;
  }

  cornerstoneGlobal.__sono_cornerstone_init_promise__ = (async () => {
    await initCornerstoneCore();
    if (!toolsInitialized) {
      try {
        initCornerstoneTools();
      } catch {
        // Already initialized by a previous hot reload.
      }
      registerTools();
      toolsInitialized = true;
      cornerstoneGlobal.__sono_cornerstone_tools_initialized__ = true;
    }

    const username = import.meta.env.VITE_DICOMWEB_USERNAME ?? 'admin';
    const password = import.meta.env.VITE_DICOMWEB_PASSWORD ?? 'sonocloud2024';
    const authHeader = `Basic ${btoa(`${username}:${password}`)}`;

    try {
      dicomImageLoader.init({
        maxWebWorkers: 1,
        beforeSend: (xhr) => {
          xhr.setRequestHeader('Authorization', authHeader);
          return { Authorization: authHeader };
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('already registered')) {
        throw error;
      }
    }

    initialized = true;
    cornerstoneGlobal.__sono_cornerstone_initialized__ = true;
  })();

  try {
    await cornerstoneGlobal.__sono_cornerstone_init_promise__;
  } finally {
    cornerstoneGlobal.__sono_cornerstone_init_promise__ = undefined;
  }
};

export const createViewport = async (element: HTMLDivElement): Promise<void> => {
  await initializeCornerstone();

  const existing = getRenderingEngine(RENDERING_ENGINE_ID);
  if (existing) {
    try {
      existing.disableElement(VIEWPORT_ID);
    } catch {
      // no-op
    }
  }

  const renderingEngine = existing ?? new RenderingEngine(RENDERING_ENGINE_ID);

  renderingEngine.enableElement({
    viewportId: VIEWPORT_ID,
    type: Enums.ViewportType.STACK,
    element,
  });

  ensureToolGroup();
};

export const renderStack = async (imageIds: string[], currentImageIndex = 0): Promise<void> => {
  const renderingEngine = getRenderingEngine(RENDERING_ENGINE_ID);
  if (!renderingEngine) return;

  const viewport = renderingEngine.getViewport(VIEWPORT_ID) as Types.IStackViewport | undefined;
  if (!viewport || !imageIds.length) return;

  await viewport.setStack(imageIds, currentImageIndex);
  viewport.render();
};

export const setCurrentImage = async (imageIndex: number): Promise<void> => {
  const renderingEngine = getRenderingEngine(RENDERING_ENGINE_ID);
  if (!renderingEngine) return;

  const viewport = renderingEngine.getViewport(VIEWPORT_ID) as Types.IStackViewport | undefined;
  if (!viewport) return;

  await viewport.setImageIdIndex(imageIndex);
  viewport.render();
};

export const resetViewport = (): void => {
  const renderingEngine = getRenderingEngine(RENDERING_ENGINE_ID);
  if (!renderingEngine) return;

  const viewport = renderingEngine.getViewport(VIEWPORT_ID) as Types.IStackViewport | undefined;
  if (!viewport) return;

  viewport.resetCamera();
  viewport.render();
};

export const setViewerTool = (tool: ViewerTool): void => {
  const toolName = VIEWER_TOOL_TO_CS_TOOL[tool];
  if (!toolName) return;

  const toolGroup = ToolGroupManager.getToolGroup(TOOL_GROUP_ID);
  if (!toolGroup) return;

  const uniqueToolNames = Array.from(
    new Set(Object.values(VIEWER_TOOL_TO_CS_TOOL).filter(Boolean) as string[])
  );
  uniqueToolNames.forEach((candidateToolName) => {
    if (candidateToolName === toolName) {
      toolGroup.setToolActive(candidateToolName, { bindings: ACTIVE_BINDING });
      return;
    }
    toolGroup.setToolPassive(candidateToolName, { removeAllBindings: true });
  });
};

export const getAnnotationLayers = (
  classNamesById: Record<string, string>,
  defaultClassId: string
): AnnotationLayer[] => {
  const annotations = csToolsAnnotation.state.getAllAnnotations() as Array<{
    annotationUID?: string;
    metadata?: { toolName?: string; referencedImageId?: string; referencedImageURI?: string };
    data?: Record<string, unknown> & { handles?: { points?: Types.Point3[] } };
  }>;

  const layers: AnnotationLayer[] = [];
  annotations.forEach((annotation) => {
    const annotationUID = annotation.annotationUID;
    const toolName = annotation.metadata?.toolName;
    if (!annotationUID || !toolName) return;

    const layerTool = TOOL_NAME_TO_LAYER_TOOL.get(toolName);
    if (!layerTool) return;

    const classIdValue = annotation.data?.classId;
    const classId =
      typeof classIdValue === 'string' && classIdValue.trim() ? classIdValue : defaultClassId;
    if (annotation.data) {
      annotation.data.classId = classId;
    }

    const className = classNamesById[classId] ?? classId;
    const rawLabel = annotation.data?.label;
    const label =
      typeof rawLabel === 'string' && rawLabel.trim() ? rawLabel.trim() : `${className} ${layerTool}`;

    const referencedImageId =
      annotation.metadata?.referencedImageId ?? annotation.metadata?.referencedImageURI;
    const frameIndex = parseFrameIndex(referencedImageId);
    const visible = csToolsAnnotation.visibility.isAnnotationVisible(annotationUID) !== false;

    layers.push({
      id: annotationUID,
      tool: layerTool,
      label,
      frameIndex,
      visible,
      bbox: getAnnotationBoundingBox(annotation),
      measurement: extractMeasurement(annotation.data?.cachedStats),
      classId,
    });
  });

  return layers.sort((a, b) => a.frameIndex - b.frameIndex);
};

export const subscribeToAnnotationChanges = (onChange: () => void): (() => void) => {
  const events = [
    csToolsEnums.Events.ANNOTATION_ADDED,
    csToolsEnums.Events.ANNOTATION_COMPLETED,
    csToolsEnums.Events.ANNOTATION_MODIFIED,
    csToolsEnums.Events.ANNOTATION_REMOVED,
    csToolsEnums.Events.ANNOTATION_VISIBILITY_CHANGE,
  ];

  const listener: EventListener = () => {
    onChange();
  };

  events.forEach((eventName) => {
    eventTarget.addEventListener(eventName, listener);
  });

  return () => {
    events.forEach((eventName) => {
      eventTarget.removeEventListener(eventName, listener);
    });
  };
};

export const setAnnotationLayerVisibility = (annotationUID: string, visible: boolean): void => {
  csToolsAnnotation.visibility.setAnnotationVisibility(annotationUID, visible);
  renderViewport();
};

export const removeAnnotationLayer = (annotationUID: string): void => {
  csToolsAnnotation.state.removeAnnotation(annotationUID);
  renderViewport();
};

export const removeAllAnnotationLayers = (): void => {
  csToolsAnnotation.state.removeAllAnnotations();
  renderViewport();
};

export const cacheWadorsMetadata = (imageId: string, metadata: unknown): void => {
  dicomImageLoader.wadors.metaDataManager.add(
    imageId,
    metadata as Parameters<typeof dicomImageLoader.wadors.metaDataManager.add>[1]
  );
};
