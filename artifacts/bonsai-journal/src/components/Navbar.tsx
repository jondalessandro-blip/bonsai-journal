import { useLocation, Link as WouterLink } from "wouter";
import { useUser, useClerk, Show } from "@clerk/react";
import { LogOut, User } from "lucide-react";
import { Button } from "./ui/button";

function DualLeafIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* stem */}
      <path d="M12 22 C12 22 11.5 16 12 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      {/* left leaf */}
      <path d="M12 13 C11 11 7 9.5 5 6 C5 6 8.5 5 11 8 C11.8 9 12 11 12 13Z" />
      {/* right leaf */}
      <path d="M12 13 C13 11 17 9.5 19 6 C19 6 15.5 5 13 8 C12.2 9 12 11 12 13Z" />
    </svg>
  );
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();

  const displayName = user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "Account";

  return (
    <div className="flex items-center gap-2">
      <div className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground">
        <User className="h-3.5 w-3.5" />
        <span className="max-w-[140px] truncate">{displayName}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-foreground gap-1.5"
        onClick={() => signOut({ redirectUrl: basePath || "/" })}
      >
        <LogOut className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
    </div>
  );
}

export function Navbar() {
  const [location] = useLocation();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-5xl flex h-16 items-center px-4 justify-between">
        <div className="flex items-center gap-6">
          <WouterLink href="/" className="flex items-center gap-2 group">
            <div className="bg-primary/10 p-1.5 rounded-md group-hover:bg-primary/20 transition-colors">
              <DualLeafIcon className="h-5 w-5 text-primary" />
            </div>
            <span className="font-serif text-lg font-medium">
              Bonsai Journal{" "}
              <span className="text-muted-foreground font-sans text-sm ml-1">盆栽</span>
            </span>
          </WouterLink>

          <Show when="signed-in">
            <div className="hidden md:flex items-center gap-1">
              <WouterLink
                href="/"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location === "/" || location.startsWith("/trees")
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                Collection
              </WouterLink>
              <WouterLink
                href="/stats"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location === "/stats"
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                Stats
              </WouterLink>
            </div>
          </Show>
        </div>

        <Show when="signed-in">
          <UserMenu />
        </Show>
        <Show when="signed-out">
          <span className="hidden md:block text-sm text-muted-foreground italic tracking-wide">
            A quiet record of every tree
          </span>
        </Show>
      </div>
    </nav>
  );
}
