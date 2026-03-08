import { LayoutDashboard, Package, Bell, Settings, BarChart3, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type View = 'dashboard' | 'products' | 'alerts' | 'analytics' | 'settings';

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
  unreadAlerts: number;
}

const Sidebar = ({ activeView, onViewChange, unreadAlerts }: SidebarProps) => {
  const links = [
    { id: 'dashboard' as View, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products' as View, label: 'Produits', icon: Package },
    { id: 'alerts' as View, label: 'Alertes', icon: Bell, badge: unreadAlerts },
    { id: 'analytics' as View, label: 'Analytique', icon: BarChart3 },
    { id: 'settings' as View, label: 'Paramètres', icon: Settings },
  ];

  return (
    <div className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display font-bold text-sidebar-accent-foreground text-lg leading-tight">PriceWatch</h1>
            <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider">Monitoring TN</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {links.map(link => (
          <button
            key={link.id}
            onClick={() => onViewChange(link.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              activeView === link.id
                ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <link.icon className="h-4.5 w-4.5" />
            <span className="flex-1 text-left">{link.label}</span>
            {link.badge ? (
              <span className="bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded-full font-bold min-w-[20px] text-center">
                {link.badge}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="text-xs text-sidebar-foreground/50">
          <p>Mytek Dashboard</p>
          <p className="mt-0.5">v1.0.0</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
export type { View };
