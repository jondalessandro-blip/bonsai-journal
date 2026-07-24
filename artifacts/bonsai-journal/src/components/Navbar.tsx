import { useLocation, Link as WouterLink } from "wouter";
import { TreePine, BarChart3, Menu, Leaf } from "lucide-react";
import { Button } from "./ui/button";

export function Navbar() {
  const [location] = useLocation();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-5xl flex h-16 items-center px-4 justify-between">
        <div className="flex items-center gap-6">
          <WouterLink href="/" className="flex items-center gap-2 group">
            <div className="bg-primary/10 p-1.5 rounded-md group-hover:bg-primary/20 transition-colors">
              <TreePine className="h-5 w-5 text-primary" />
            </div>
            <span className="font-serif text-lg font-medium">Bonsai Journal <span className="text-muted-foreground font-sans text-sm ml-1">盆栽</span></span>
          </WouterLink>
          
          <div className="hidden md:flex items-center gap-1">
            <WouterLink href="/" className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${location === '/' || location.startsWith('/trees') ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-secondary/50'}`}>
              Collection
            </WouterLink>
            <WouterLink href="/stats" className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${location === '/stats' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-secondary/50'}`}>
              Stats
            </WouterLink>
          </div>
        </div>
      </div>
    </nav>
  );
}
