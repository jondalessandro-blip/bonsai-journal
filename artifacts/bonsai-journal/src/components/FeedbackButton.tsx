import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Show } from "@clerk/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const CATEGORIES = [
  { value: "bug", label: "Bug" },
  { value: "idea", label: "Idea" },
  { value: "other", label: "Other" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category | "">("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  function reset() {
    setCategory("");
    setMessage("");
    setStatus("idle");
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Small delay so the dialog closes before state resets
      setTimeout(reset, 300);
    }
  }

  async function handleSubmit() {
    if (!category || !message.trim()) return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, message: message.trim() }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("success");
      setTimeout(() => handleOpenChange(false), 1500);
    } catch {
      setStatus("error");
    }
  }

  return (
    <Show when="signed-in">
      <>
        <button
          onClick={() => setOpen(true)}
          aria-label="Send feedback"
          className="fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <MessageSquare className="h-5 w-5" />
        </button>

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Send feedback</DialogTitle>
            </DialogHeader>

            {status === "success" ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Thanks — got it!
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="feedback-category">Category</Label>
                  <Select
                    value={category}
                    onValueChange={(v) => setCategory(v as Category)}
                  >
                    <SelectTrigger id="feedback-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="feedback-message">Message</Label>
                  <Textarea
                    id="feedback-message"
                    placeholder="What's on your mind?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                  />
                </div>

                {status === "error" && (
                  <p className="text-sm text-destructive">
                    Something went wrong — please try again.
                  </p>
                )}

                <Button
                  onClick={handleSubmit}
                  disabled={!category || !message.trim() || status === "submitting"}
                  className="w-full"
                >
                  {status === "submitting" ? "Sending…" : "Send feedback"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    </Show>
  );
}
