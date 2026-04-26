import { Link } from "react-router-dom";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src="/SpotterLogo.png"
        alt="Spotter"
        className="h-8 w-8 object-contain rounded"
      />
      <span className="font-display tracking-tight text-foreground">Spotter</span>
    </Link>
  );
}
