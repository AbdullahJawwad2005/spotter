import { Link } from "react-router-dom";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2 ${className}`}>
      <span className="relative inline-block h-5 w-5">
        <span className="absolute inset-0 rounded-[5px] bg-primary" />
        <span className="absolute inset-[3px] rounded-[2px] border-[1.5px] border-primary-foreground/80" />
      </span>
      <span className="font-display tracking-tight text-foreground">FormCheck<span className="text-primary">.</span>ai</span>
    </Link>
  );
}