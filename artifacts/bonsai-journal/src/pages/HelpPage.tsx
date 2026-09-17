import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function HelpPage() {
  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <Link href="/">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-4 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Collection
        </Button>
      </Link>

      <div className="space-y-2">
        <h1 className="text-3xl font-serif text-foreground">Help</h1>
        <p className="text-muted-foreground">Content coming soon</p>
      </div>
    </div>
  );
}