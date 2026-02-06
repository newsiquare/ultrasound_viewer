import {
  Enums,
  RenderingEngine,
  init as initCornerstoneCore,
  getRenderingEngine,
  type Types,
} from '@cornerstonejs/core';
import dicomImageLoader from '@cornerstonejs/dicom-image-loader';

type CornerstoneGlobalState = typeof globalThis & {
  __sono_cornerstone_initialized__?: boolean;
  __sono_cornerstone_init_promise__?: Promise<void>;
};

const cornerstoneGlobal = globalThis as CornerstoneGlobalState;

let initialized = Boolean(cornerstoneGlobal.__sono_cornerstone_initialized__);

export const VIEWPORT_ID = 'dicom-viewport';
export const RENDERING_ENGINE_ID = 'dicom-rendering-engine';

export const initializeCornerstone = async (): Promise<void> => {
  if (initialized) return;
  if (cornerstoneGlobal.__sono_cornerstone_init_promise__) {
    await cornerstoneGlobal.__sono_cornerstone_init_promise__;
    return;
  }

  cornerstoneGlobal.__sono_cornerstone_init_promise__ = (async () => {
    await initCornerstoneCore();

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

export const cacheWadorsMetadata = (imageId: string, metadata: unknown): void => {
  dicomImageLoader.wadors.metaDataManager.add(
    imageId,
    metadata as Parameters<typeof dicomImageLoader.wadors.metaDataManager.add>[1]
  );
};
