import { ChevronDown, Eye, EyeOff, Trash2, Download } from 'lucide-react';
import type { AnnotationClass, AnnotationExportScope, AnnotationLayer } from '../types/dicom';

type Props = {
  classes: AnnotationClass[];
  layers: AnnotationLayer[];
  selectedClassId: string;
  exportScope: AnnotationExportScope;
  onSelectClass: (classId: string) => void;
  onChangeLayerClass: (layerId: string, classId: string) => void;
  onExportScopeChange: (scope: AnnotationExportScope) => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  onToggleClassVisibility: (classId: string) => void;
  onToggleLayerVisibility: (layerId: string) => void;
  onSetAllClassesVisibility: (visible: boolean) => void;
  onSetAllLayersVisibility: (visible: boolean) => void;
  onDeleteClass: (classId: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onClearClasses: () => void;
  onClearLayers: () => void;
};

export const AnnotationPanel = ({
  classes,
  layers,
  selectedClassId,
  exportScope,
  onSelectClass,
  onChangeLayerClass,
  onExportScopeChange,
  onExportJson,
  onExportCsv,
  onToggleClassVisibility,
  onToggleLayerVisibility,
  onSetAllClassesVisibility,
  onSetAllLayersVisibility,
  onDeleteClass,
  onDeleteLayer,
  onClearClasses,
  onClearLayers,
}: Props): JSX.Element => {
  return (
    <aside className="annotation-panel">
      <div className="panel-header with-actions">
        <h2>Annotations</h2>
        <div className="header-actions">
          <select
            value={exportScope}
            onChange={(event) => onExportScopeChange(event.target.value as AnnotationExportScope)}
            title="Export scope"
          >
            <option value="current">Current study</option>
            <option value="all">All studies</option>
          </select>
          <button type="button" onClick={onExportJson}>
            <Download size={14} /> JSON
          </button>
          <button type="button" onClick={onExportCsv}>
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      <section className="annotation-block">
        <div className="annotation-title">
          <div>
            <ChevronDown size={14} />
            <h3>Category List</h3>
          </div>
          <div>
            <button type="button" onClick={() => onSetAllClassesVisibility(true)} title="Show all">
              <Eye size={14} />
            </button>
            <button type="button" onClick={() => onSetAllClassesVisibility(false)} title="Hide all">
              <EyeOff size={14} />
            </button>
            <button type="button" onClick={onClearClasses} title="Delete all">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="annotation-list">
          {classes.map((item) => (
            <div
              key={item.id}
              className={`annotation-row category-row ${selectedClassId === item.id ? 'selected' : ''}`}
            >
              <button type="button" className="row-main row-main-btn" onClick={() => onSelectClass(item.id)}>
                <span className="color-dot" style={{ backgroundColor: item.color }} />
                <span>{item.name}</span>
              </button>
              <div className="row-actions">
                <button type="button" onClick={() => onToggleClassVisibility(item.id)}>
                  {item.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button type="button" onClick={() => onDeleteClass(item.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="annotation-block">
        <div className="annotation-title">
          <div>
            <ChevronDown size={14} />
            <h3>Annotation Layers</h3>
          </div>
          <div>
            <button type="button" onClick={() => onSetAllLayersVisibility(true)} title="Show all">
              <Eye size={14} />
            </button>
            <button type="button" onClick={() => onSetAllLayersVisibility(false)} title="Hide all">
              <EyeOff size={14} />
            </button>
            <button type="button" onClick={onClearLayers} title="Delete all">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="annotation-list">
          {layers.map((item) => (
            <div key={item.id} className="annotation-row">
              <div className="row-main">
                <span className="tool-pill">{item.tool}</span>
                <span>{item.label}</span>
                <select
                  value={item.classId}
                  onChange={(event) => onChangeLayerClass(item.id, event.target.value)}
                  title="Change category"
                >
                  {classes.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row-actions">
                <button type="button" onClick={() => onToggleLayerVisibility(item.id)}>
                  {item.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button type="button" onClick={() => onDeleteLayer(item.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
};
