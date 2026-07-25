import { useGetTree, useGetTreeTimeline, useDeleteTree, useUpdateTreeReminder } from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Leaf, Scissors, Edit2, Trash2, Clock, CheckCircle2, Circle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TreeForm } from "@/components/TreeForm";
import { LogForm } from "@/components/LogForm";
import { ReminderForm } from "@/components/ReminderForm";
import { Lightbox, PhotoZoomHint } from "@/components/Lightbox";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export default function TreeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const { data: tree, isLoading: isTreeLoading } = useGetTree(id!, {
    query: { enabled: !!id, queryKey: ["/api/trees", id] }
  });

  const { data: timeline } = useGetTreeTimeline(id!, {
    query: { enabled: !!id, queryKey: ["/api/trees", id, "timeline"] }
  });

  const deleteTree = useDeleteTree();
  const updateReminder = useUpdateTreeReminder();

  if (isTreeLoading) return <div className="p-8 animate-pulse text-center">Loading...</div>;
  if (!tree) return <div className="p-8 text-center">Tree not found.</div>;

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this tree? This cannot be undone.")) {
      deleteTree.mutate({ id: tree.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
          setLocation("/");
        }
      });
    }
  };

  const handleToggleReminder = (reminderId: string, completed: boolean) => {
    updateReminder.mutate({ id: tree.id, reminderId, data: { completed } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/trees", tree.id, "timeline"] });
        queryClient.invalidateQueries({ queryKey: ["/api/trees", tree.id, "reminders"] });
      }
    });
  };

  // Simple markdown renderer for notes
  const renderNotes = (text: string) => {
    return { __html: text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>')
    };
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <Link href="/">
          <Button variant="ghost" size="sm" className="-ml-4 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Collection
          </Button>
        </Link>
        <div className="flex gap-2">
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Edit2 className="w-4 h-4 mr-2" /> Edit</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Tree</DialogTitle>
              </DialogHeader>
              <TreeForm initialData={tree} onSuccess={() => setIsEditOpen(false)} />
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive border-transparent" onClick={handleDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Col - Photo & Primary Info */}
        <div className="md:col-span-1 space-y-6">
          <div className="rounded-xl overflow-hidden border bg-card shadow-sm aspect-[3/4] relative">
            {tree.photoUrl ? (
              <div className="relative w-full h-full group" onClick={() => setLightboxOpen(true)}>
                <img src={tree.photoUrl} alt={tree.name} className="w-full h-full object-cover" />
                <PhotoZoomHint />
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 bg-muted">
                <Leaf className="w-16 h-16 mb-4 opacity-20" />
                <span className="tracking-widest uppercase text-xs">No Photo</span>
              </div>
            )}
          </div>

          {lightboxOpen && tree.photoUrl && (
            <Lightbox src={tree.photoUrl} alt={tree.name} onClose={() => setLightboxOpen(false)} />
          )}
          
          <div className="bg-card p-5 rounded-xl border shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-2">Details</h3>
              <dl className="space-y-2 text-sm">
                {tree.acquiredDate && (
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <dt className="text-muted-foreground">Acquired</dt>
                    <dd>{format(parseISO(tree.acquiredDate), 'MMM yyyy')}</dd>
                  </div>
                )}
                {tree.climate && (
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <dt className="text-muted-foreground">Climate</dt>
                    <dd>{tree.climate}</dd>
                  </div>
                )}
                {tree.foliage && (
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <dt className="text-muted-foreground">Foliage</dt>
                    <dd>{tree.foliage}</dd>
                  </div>
                )}
                {tree.style && (
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <dt className="text-muted-foreground">Style</dt>
                    <dd>{tree.style}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>

        {/* Right Col - Content */}
        <div className="md:col-span-2 space-y-8">
          <div>
            <h1 className="text-4xl font-serif text-foreground mb-1">{tree.name}</h1>
            {tree.species && <p className="text-xl italic text-muted-foreground">{tree.species}</p>}
          </div>

          {tree.notes && (
            <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none bg-card/50 p-6 rounded-xl border border-primary/10">
              <p dangerouslySetInnerHTML={renderNotes(tree.notes)} />
            </div>
          )}

          <div className="space-y-6 pt-6 border-t">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-serif">Care Journal</h2>
              <div className="flex gap-2">
                <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm"><Scissors className="w-4 h-4 mr-2" /> Log Care</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Care Log</DialogTitle>
                    </DialogHeader>
                    <LogForm treeId={tree.id} onSuccess={() => setIsLogOpen(false)} />
                  </DialogContent>
                </Dialog>
                
                <Dialog open={isReminderOpen} onOpenChange={setIsReminderOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm"><Calendar className="w-4 h-4 mr-2" /> Plan</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Schedule Care</DialogTitle>
                    </DialogHeader>
                    <ReminderForm treeId={tree.id} onSuccess={() => setIsReminderOpen(false)} />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
              {timeline?.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm italic">
                  The pages are blank. Start logging care.
                </div>
              )}
              {timeline?.map((event) => {
                const isReminder = event.kind === "reminder";
                const isCompleted = isReminder && event.completed;
                const date = parseISO(event.date);
                
                return (
                  <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-card shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10 text-primary">
                      {isReminder ? (
                        <button onClick={() => handleToggleReminder(event.id, !event.completed)} className="hover:text-primary transition-colors focus:outline-none">
                          {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5 opacity-50 hover:opacity-100" />}
                        </button>
                      ) : (
                        <Leaf className="w-4 h-4 opacity-70" />
                      )}
                    </div>
                    
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border bg-card shadow-sm transition-all hover:shadow-md">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-medium ${isReminder && !isCompleted ? 'text-primary' : 'text-foreground'}`}>
                          {event.type} {isReminder && !isCompleted && "(Planned)"}
                        </span>
                        <time className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                          {format(date, 'MMM d, yyyy')}
                        </time>
                      </div>
                      {event.notes && (
                        <p className={`text-sm mt-2 ${isReminder && isCompleted ? 'line-through text-muted-foreground/60' : 'text-muted-foreground'}`}>
                          {event.notes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
