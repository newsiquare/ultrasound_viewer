import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Files,
  MonitorPlay,
  Activity,
} from 'lucide-react';

const menu = [
  { key: 'Dashboard', icon: LayoutDashboard },
  { key: 'Patients', icon: Users },
  { key: 'Studies', icon: FolderKanban },
  { key: 'File management', icon: Files },
  { key: 'DICOM viewer', icon: MonitorPlay, active: true },
];

export const SideNav = (): JSX.Element => {
  return (
    <aside className="side-nav">
      <div className="logo-wrap">
        <div className="logo-icon">
          <Activity size={18} />
        </div>
        <div>
          <p className="logo-title">SonoCloud</p>
          <p className="logo-sub">US Workstation</p>
        </div>
      </div>

      <nav className="menu-list">
        {menu.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.key} className={`menu-item ${item.active ? 'active' : ''}`}>
              <Icon size={17} />
              <span>{item.key}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
