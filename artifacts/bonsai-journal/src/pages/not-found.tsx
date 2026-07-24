import { useLocation } from "wouter";

export default function NotFound() {
  const [location] = useLocation();

  return (
    <div className="flex items-center justify-center min-h-[60vh] text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-6xl font-serif text-muted-foreground">404</h1>
        <h2 className="text-2xl font-serif">Page Not Found</h2>
        <p className="text-muted-foreground pb-4">
          The path <code className="bg-muted px-1.5 py-0.5 rounded text-sm">{location}</code> doesn't exist in your journal.
        </p>
      </div>
    </div>
  );
}
