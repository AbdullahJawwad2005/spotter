import { Link, useLocation } from "react-router-dom";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", label: "AI Coach" },
  { path: "/trainer", label: "Form Check" },
  { path: "/workout", label: "Workout Plan" },
  { path: "/nutrition", label: "Nutrition" },
];

export function Navigation() {
  const location = useLocation();

  return (
    <header className="border-b hairline border-border sticky top-0 bg-background/85 backdrop-blur-md z-30">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md transition-colors",
                location.pathname === item.path
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
