import { Shield, Activity, Search, BarChart3, Clock, AlertTriangle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const navItems = [
  { to: "/", icon: BarChart3, label: "Dashboard" },
  { to: "/scan", icon: Search, label: "New Scan" },
  { to: "/history", icon: Clock, label: "History" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border glass sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="relative">
              <Shield className="h-7 w-7 text-primary" />
              <Activity className="h-3 w-3 text-accent absolute -top-0.5 -right-0.5" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              <span className="text-gradient-primary">Aegis</span>
              <span className="text-foreground">Intel</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === to
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {/* Main */}
      <main className="flex-1 container px-4 py-6">
        {children}
      </main>
    </div>
  );
}
