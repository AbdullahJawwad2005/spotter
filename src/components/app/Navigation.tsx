import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Calendar, MessageSquare, LayoutDashboard, Apple, ScanLine, Sun, Moon } from "lucide-react";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/calendar", label: "Schedule", icon: Calendar },
  { path: "/trainer", label: "Form Coach", icon: ScanLine },
  { path: "/chat", label: "AI Coach", icon: MessageSquare },
  { path: "/nutrition", label: "Nutrition", icon: Apple },
];

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('spotter-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <header className="border-b border-border sticky top-0 bg-background/85 backdrop-blur-md z-30">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
        <Logo />
        {user && (
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5",
                  location.pathname === item.path
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            ))}
          </nav>
        )}
        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground max-w-[120px] truncate">
                {profile?.full_name || user.email}
              </span>
            </div>
            <button
              onClick={() => setIsDark(v => !v)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      {/* Mobile nav */}
      {user && (
        <div className="md:hidden border-t border-border bg-background/90 backdrop-blur-md">
          <div className="flex items-center justify-around px-2 py-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] rounded-md transition-colors",
                  location.pathname === item.path
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
