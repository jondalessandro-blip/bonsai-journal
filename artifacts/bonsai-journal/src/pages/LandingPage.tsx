import { Link as WouterLink } from "wouter";
import { Button } from "@/components/ui/button";

function DualLeafIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 22 C12 22 11.5 16 12 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M12 13 C11 11 7 9.5 5 6 C5 6 8.5 5 11 8 C11.8 9 12 11 12 13Z" />
      <path d="M12 13 C13 11 17 9.5 19 6 C19 6 15.5 5 13 8 C12.2 9 12 11 12 13Z" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-4 text-center">
      <div className="max-w-sm w-full space-y-8">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-primary/10 p-4 rounded-2xl">
            <DualLeafIcon className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h1 className="font-serif text-3xl font-medium text-foreground">
              Bonsai Journal
            </h1>
            <p className="text-muted-foreground mt-1 text-sm tracking-wide">
              盆栽 · A quiet record of every tree
            </p>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
            Track your bonsai collection, log care, set reminders, and watch your trees
            grow over time — all in one private journal.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <WouterLink href="/sign-up">
            <Button className="w-full" size="lg">
              Get started
            </Button>
          </WouterLink>
          <WouterLink href="/sign-in">
            <Button variant="outline" className="w-full" size="lg">
              Sign in
            </Button>
          </WouterLink>
        </div>
      </div>
    </div>
  );
}
