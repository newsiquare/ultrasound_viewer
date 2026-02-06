import {
  Play,
  Pause,
  RotateCcw,
  Move,
  Search,
  SlidersHorizontal,
  Pencil,
  Ruler,
  Palette,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import {
  createViewport,
  renderStack,
  resetViewport,
  setCurrentImage,
  setViewerTool,
} from '../services/cornerstone';
import type { ViewerTool } from '../types/tools';
import type { AnnotationLayer } from '../types/dicom';

const TOOLBAR_GROUPS: Array<{ label: string; items: ViewerTool[] }> = [
  { label: 'View', items: ['Reset', 'Pan', 'Zoom', 'W/L'] },
  { label: 'Annotate', items: ['Annotate-Rect', 'Annotate-Freehand', 'Annotate-Text'] },
  {
    label: 'Measure',
    items: ['Measure-Length', 'Measure-Angle', 'Measure-Rect', 'Measure-Ellipse', 'Measure-Bidirectional'],
  },
  { label: 'Image', items: ['LUT', 'Filter'] },
];

const iconForTool = (tool: ViewerTool): JSX.Element => {
  if (tool === 'Reset') return <RotateCcw size={14} />;
  if (tool === 'Pan') return <Move size={14} />;
  if (tool === 'Zoom') return <Search size={14} />;
  if (tool === 'W/L') return <SlidersHorizontal size={14} />;
  if (tool.startsWith('Annotate')) return <Pencil size={14} />;
  if (tool.startsWith('Measure')) return <Ruler size={14} />;
  if (tool === 'LUT') return <Palette size={14} />;
  return <Sparkles size={14} />;
};

type Props = {
  activeTool: ViewerTool;
  imageIds: string[];
  currentFrame: number;
  fps: number;
  isPlaying: boolean;
  loading: boolean;
  errorMessage: string | null;
  selectedStudyName: string | null;
  layers: AnnotationLayer[];
  onToolChange: (tool: ViewerTool) => void;
  onFrameChange: (frame: number) => void;
  onFpsChange: (fps: number) => void;
  onPlayingChange: (playing: boolean) => void;
};

export const ViewerArea = ({
  activeTool,
  imageIds,
  currentFrame,
  fps,
  isPlaying,
  loading,
  errorMessage,
  selectedStudyName,
  layers,
  onToolChange,
  onFrameChange,
  onFpsChange,
  onPlayingChange,
}: Props): JSX.Element => {
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!viewportRef.current) return;
    createViewport(viewportRef.current).catch((error: unknown) => {
      console.error(error);
    });
  }, []);

  useEffect(() => {
    if (!imageIds.length) return;
    renderStack(imageIds, currentFrame).catch((error: unknown) => {
      console.error(error);
    });
  }, [imageIds]);

  useEffect(() => {
    if (!imageIds.length) return;
    setCurrentImage(currentFrame).catch((error: unknown) => {
      console.error(error);
    });
  }, [currentFrame, imageIds]);

  useEffect(() => {
    setViewerTool(activeTool);
    if (activeTool === 'Reset') {
      resetViewport();
    }
  }, [activeTool]);

  useEffect(() => {
    if (!isPlaying || imageIds.length <= 1) return;

    const timer = window.setInterval(() => {
      const nextFrame = (currentFrame + 1) % imageIds.length;
      onFrameChange(nextFrame);
    }, Math.max(1000 / fps, 20));

    return () => window.clearInterval(timer);
  }, [isPlaying, fps, currentFrame, imageIds.length, onFrameChange]);

  const visibleLayers = useMemo(() => layers.filter((item) => item.visible), [layers]);

  return (
    <section className="viewer-area">
      <div className="toolbar">
        {TOOLBAR_GROUPS.map((group) => (
          <div className="tool-group" key={group.label}>
            {group.items.map((item) => (
              <button
                key={item}
                type="button"
                className={activeTool === item ? 'active' : ''}
                onClick={() => onToolChange(item)}
              >
                {iconForTool(item)}
                {item}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="image-area">
        <div ref={viewportRef} className="cornerstone-canvas" />
        {loading ? <div className="viewer-status">Loading selected study...</div> : null}
        {!loading && errorMessage ? <div className="viewer-status error">{errorMessage}</div> : null}
        {!loading && !errorMessage && selectedStudyName && imageIds.length === 0 ? (
          <div className="viewer-status">
            No displayable instances found in this study.
          </div>
        ) : null}
        {!loading && !errorMessage && !selectedStudyName ? (
          <div className="viewer-status">Select a study to load DICOM frames.</div>
        ) : null}

        <div className="overlay overlay-top-left">
          <p>MI: 0.8</p>
          <p>TIS: 0.4</p>
          <p>Mode: B-Mode</p>
          <p>Freq: 8.5 MHz</p>
          <p>Depth: 5.6 cm</p>
        </div>

        <div className="overlay overlay-top-right">
          <p>Active Tool: {activeTool}</p>
          <p>Frame: {currentFrame + 1}</p>
          <p>Total: {imageIds.length || 0}</p>
        </div>

        <div className="overlay overlay-bottom-left">
          {visibleLayers.slice(0, 3).map((layer) => (
            <p key={layer.id}>
              bbox [{layer.bbox.join(', ')}] {layer.measurement ? `| ${layer.measurement}` : ''}
            </p>
          ))}
        </div>
      </div>

      <div className="playback-bar">
        <button
          type="button"
          onClick={() => onPlayingChange(!isPlaying)}
          disabled={imageIds.length <= 1}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        <input
          type="range"
          min={0}
          max={Math.max(imageIds.length - 1, 0)}
          value={Math.min(currentFrame, Math.max(imageIds.length - 1, 0))}
          onChange={(event) => onFrameChange(Number(event.target.value))}
          disabled={imageIds.length === 0}
        />

        <label>
          Frame
          <input
            type="number"
            min={1}
            max={Math.max(imageIds.length, 1)}
            value={Math.min(currentFrame + 1, Math.max(imageIds.length, 1))}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isNaN(value)) return;
              onFrameChange(Math.max(0, Math.min(value - 1, imageIds.length - 1)));
            }}
            disabled={imageIds.length === 0}
          />
        </label>

        <label>
          FPS
          <input
            type="number"
            min={1}
            max={120}
            value={fps}
            onChange={(event) => onFpsChange(Math.max(1, Math.min(120, Number(event.target.value) || 24)))}
          />
        </label>
      </div>
    </section>
  );
};
