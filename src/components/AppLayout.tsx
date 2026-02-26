import { BarChart3, Clock, GitCompareArrows, Shield, LogOut, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GlobalSearch } from "@/components/GlobalSearch";
import threatLensLogo from "@/assets/threatlens-logo.png";

const navItems = [
  { to: "/", icon: BarChart3, label: "Dashboard" },
  { to: "/history", icon: Clock, label: "History" },
  { to: "/compare", icon: GitCompareArrows, label: "Compare" },
  { to: "/policies", icon: Shield, label: "Policies" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { session, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border glass sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14 px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={threatLensLogo} alt="ThreatLens" className="h-7 w-7 rounded-md" />
            <span className="text-lg font-bold tracking-tight">
              <span className="text-gradient-primary">Threat</span>
              <span className="text-foreground">Lens</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <GlobalSearch />
            <nav className="flex items-center gap-0.5">
              {navItems.map(({ to, icon: Icon, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    location.pathname === to
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              ))}
            </nav>
            {session && (
              <div className="flex items-center gap-1 ml-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      <Avatar className="h-7 w-7 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all">
                        <AvatarImage src={session.user.user_metadata?.avatar_url} alt="User" />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {(session.user.email?.[0] || "U").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-auto p-3 space-y-2">
                    <div className="text-xs font-medium text-foreground">{session.user.user_metadata?.full_name || "User"}</div>
                    <div className="text-[11px] text-muted-foreground">{session.user.email}</div>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={signOut}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 container px-4 py-6">
        {children}
      </main>
    </div>
  );
}
