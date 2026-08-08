import { Link as WouterLink } from "wouter";
import { Button } from "@/components/ui/button";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-4 text-center">
      <div className="max-w-sm w-full space-y-8">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-primary/10 p-4 rounded-2xl">
            <img src={`${basePath}/logo.svg`} alt="" aria-hidden className="h-10 w-10" />
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
          <WouterLink href="/video">
            <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground" size="lg">
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              Watch the intro
            </Button>
          </WouterLink>
        </div>
      </div>
    </div>
  );
}
