import { useGetTree, useGetTreeTimeline, useDeleteTree, useUpdateTreeReminder, useDeleteTreeLog, useDeleteTreeReminder } from "@workspace/api-client-react";
import { useParams, useLocation, Link } from "wouter";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Leaf, Scissors, Edit2, Trash2, Clock, CheckCircle2, Circle, Pencil, Maximize2, X, ScrollText, Activity } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TreeForm, type TreeFormHandle } from "@/components/TreeForm";
import { LogForm } from "@/components/LogForm";
import { ReminderForm } from "@/components/ReminderForm";
import { ProgressionGallery } from "@/components/ProgressionGallery";
import { CoverPhotoHero } from "@/components/CoverPhotoHero";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

export default function TreeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditFormDirty, setIsEditFormDirty] = useState(false);
  const [showEditGuard, setShowEditGuard] = useState(false);
  const editFormRef = useRef<TreeFormHandle>(null);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [careExpanded, setCareExpanded] = useState(false);
  const [editingLog, setEditingLog] = useState<{ id: string; type: string; date: string; notes?: string | null } | null>(null);
  const [editingReminder, setEditingReminder] = useState<{ id: string; type: string; dueDate: string; notes?: string | null } | null>(null);
  const [careFilter, setCareFilter] = useState<"all" | "completed" | "planned">("all");

  // Lock body scroll when any fullscreen panel is open
  useEffect(() => {
    document.body.style.overflow = (notesExpanded || careExpanded) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [notesExpanded, careExpanded]);

  useEffect(() => {
    if (!notesExpanded && !careExpanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setNotesExpanded(false); setCareExpanded(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [notesExpanded, careExpanded]);

  const { data: tree, isLoading: isTreeLoading } = useGetTree(id!, {
    query: { enabled: !!id, queryKey: ["/api/trees", id] }
  });

  const { data: timeline } = useGetTreeTimeline(id!, {
    query: { enabled: !!id, queryKey: ["/api/trees", id, "timeline"] }
  });

  const filteredTimeline = (() => {
    const filtered = (timeline ?? []).filter((event) => {
      if (careFilter === "all") return true;
      if (careFilter === "planned") return event.kind === "reminder" && !event.completed;
      return event.kind === "log" || (event.kind === "reminder" && event.completed);
    });
    // Completed events shown newest-first; all/planned keep oldest-first
    return careFilter === "completed" ? [...filtered].reverse() : filtered;
  })();

  const deleteTree = useDeleteTree();
  const updateReminder = useUpdateTreeReminder();
  const deleteLog = useDeleteTreeLog();
  const deleteReminder = useDeleteTreeReminder();

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

  const handleDeleteLog = (logId: string) => {
    if (!confirm("Delete this care log entry?")) return;
    deleteLog.mutate({ id: tree.id, logId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/trees", tree.id, "timeline"] });
        queryClient.invalidateQueries({ queryKey: ["/api/trees", tree.id, "logs"] });
      }
    });
  };

  const handleDeleteReminder = (reminderId: string) => {
    if (!confirm("Delete this planned reminder?")) return;
    deleteReminder.mutate({ id: tree.id, reminderId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/trees", tree.id, "timeline"] });
        queryClient.invalidateQueries({ queryKey: ["/api/trees", tree.id, "reminders"] });
        queryClient.invalidateQueries({ queryKey: ["/api/reminders/upcoming"] });
      }
    });
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      {/* Top bar */}
      <div className="flex justify-between items-center">
        <Link href="/">
          <Button variant="ghost" size="sm" className="-ml-4 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Collection
          </Button>
        </Link>
      </div>

      {/* Cover photo hero — repositionable banner */}
      <CoverPhotoHero
        treeId={tree.id}
        serverCoverPosition={tree.coverPosition}
      />

      {/* Name / species + actions — full-width row below the cover photo */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif text-foreground mb-1">{tree.name}</h1>
          {tree.species && <p className="text-lg md:text-xl italic text-muted-foreground">{tree.species}</p>}
        </div>
        <div className="flex gap-2 shrink-0 pt-1">
          <UnsavedChangesDialog
            open={showEditGuard}
            onSaveAndLeave={() => {
              setShowEditGuard(false);
              editFormRef.current?.submit();
            }}
            onDiscard={() => {
              setShowEditGuard(false);
              setIsEditFormDirty(false);
              setIsEditOpen(false);
            }}
            onCancel={() => setShowEditGuard(false)}
          />
          <Dialog
            open={isEditOpen}
            onOpenChange={(open) => {
              if (!open && isEditFormDirty) {
                setShowEditGuard(true);
              } else {
                setIsEditOpen(open);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Edit2 className="w-4 h-4 mr-2" /> Edit</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Tree</DialogTitle>
              </DialogHeader>
              <TreeForm
                ref={editFormRef}
                initialData={tree}
                onDirtyChange={setIsEditFormDirty}
                onSuccess={() => {
                  setIsEditFormDirty(false);
                  setIsEditOpen(false);
                }}
              />
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive border-transparent" onClick={handleDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* Left Col — Details */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-card p-5 rounded-xl border shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-2">Details</h3>
              <dl className="space-y-2 text-sm">
                {tree.status && (
                  <div className="flex justify-between items-center py-1 border-b border-border/50">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>
                      <span className={[
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                        tree.status === "Thriving"              && "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
                        tree.status === "Dormant"               && "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
                        tree.status === "Stressed/In Distress"  && "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
                        tree.status === "Sick"                  && "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
                        tree.status === "Dead/Beyond Recovery"  && "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
                        !["Thriving","Dormant","Stressed/In Distress","Sick","Dead/Beyond Recovery"].includes(tree.status) && "bg-muted text-muted-foreground",
                      ].filter(Boolean).join(" ")}>
                        {tree.status}
                      </span>
                    </dd>
                  </div>
                )}
                {tree.stage && (
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <dt className="text-muted-foreground">Stage</dt>
                    <dd className="text-right max-w-[60%]">{tree.stage}</dd>
                  </div>
                )}
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
                {tree.tags && tree.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {tree.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px] font-normal">{tag}</Badge>
                    ))}
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>

        {/* Right Col — Name, Notes, Care Journal */}
        <div className="md:col-span-2 space-y-8">
          {tree.notes && (
            <div className="bg-card/50 rounded-xl border border-primary/10 overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ScrollText className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase tracking-widest">General Notes</span>
                </div>
                <button
                  onClick={() => setNotesExpanded(true)}
                  className="flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary font-medium px-2 py-1 rounded-md hover:bg-primary/10 transition-colors"
                  aria-label="Expand notes to full screen"
                >
                  <span className="hidden sm:inline">Expand</span>
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto px-5 pb-5" style={{ maxHeight: "60vh" }}>
                <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-headings:font-serif prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground prose-a:text-primary">
                  <ReactMarkdown>{tree.notes}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* Notes full-screen overlay */}
          {notesExpanded && tree.notes && (
            <div
              className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200"
              role="dialog"
              aria-modal="true"
              aria-label="General Notes — full view"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b bg-card shrink-0">
                <div className="flex items-center gap-2.5 text-primary">
                  <ScrollText className="w-5 h-5" />
                  <div>
                    <h2 className="font-serif text-lg leading-tight">General Notes</h2>
                    <p className="text-xs text-muted-foreground">{tree.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setNotesExpanded(false)}
                  className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  aria-label="Close full-screen notes"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-6 max-w-3xl w-full mx-auto">
                <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-headings:font-serif prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground prose-a:text-primary">
                  <ReactMarkdown>{tree.notes}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* Progression gallery — below the name/notes, full right-col width */}
          <div className="pt-2">
            <ProgressionGallery treeId={tree.id} />
          </div>

          <div className="space-y-6 pt-6 border-t">
            {/* Care Journal header */}
            <div className="space-y-2">
              <h2 className="text-2xl font-serif">Care Journal</h2>
              <div className="flex gap-2 items-center">
                <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm"><Scissors className="w-4 h-4 mr-2" /> Log Care</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Care Log</DialogTitle></DialogHeader>
                    <LogForm treeId={tree.id} onSuccess={() => setIsLogOpen(false)} />
                  </DialogContent>
                </Dialog>
                <Dialog open={isReminderOpen} onOpenChange={setIsReminderOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm"><Calendar className="w-4 h-4 mr-2" /> Plan</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Schedule Care</DialogTitle></DialogHeader>
                    <ReminderForm treeId={tree.id} onSuccess={() => setIsReminderOpen(false)} />
                  </DialogContent>
                </Dialog>
                <button
                  onClick={() => setCareExpanded(true)}
                  className="flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary font-medium px-2 py-1.5 rounded-md hover:bg-primary/10 transition-colors border border-transparent hover:border-primary/20"
                  aria-label="Expand Care Journal to full screen"
                >
                  <span className="hidden sm:inline">Expand</span>
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex rounded-md border overflow-hidden text-xs font-medium w-fit">
                {(["all", "completed", "planned"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setCareFilter(f)}
                    className={`px-3 py-1.5 capitalize transition-colors ${careFilter === f ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable timeline */}
            <div className="overflow-y-auto max-h-[80vh]">
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                {filteredTimeline?.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm italic">
                    {careFilter === "all" ? "The pages are blank. Start logging care." : `No ${careFilter} entries.`}
                  </div>
                )}
                {filteredTimeline?.map((event) => {
                  const isReminder = event.kind === "reminder";
                  const isCompleted = isReminder && event.completed;
                  const isStatusChange = event.kind === "log" && event.type === "Status Change";
                  const date = parseISO(event.date);
                  return (
                    <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-card shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10 ${isStatusChange ? "text-amber-500" : "text-primary"}`}>
                        {isReminder ? (
                          <button onClick={() => handleToggleReminder(event.id, !event.completed)} className="hover:text-primary transition-colors focus:outline-none">
                            {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5 opacity-50 hover:opacity-100" />}
                          </button>
                        ) : isStatusChange ? (
                          <Activity className="w-4 h-4" />
                        ) : (
                          <Leaf className="w-4 h-4 opacity-70" />
                        )}
                      </div>
                      <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border bg-card shadow-sm transition-all hover:shadow-md ${isStatusChange ? "border-amber-200 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-900/10" : ""}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-medium ${isReminder && !isCompleted ? 'text-primary' : isStatusChange ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>
                            {isStatusChange ? "Health Status Changed" : event.type} {isReminder && !isCompleted && "(Planned)"}
                          </span>
                          <div className="flex items-center gap-1">
                            <time className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                              {format(date, 'MMM d, yyyy')}
                            </time>
                            {!isStatusChange && (
                              <button
                                onClick={() => isReminder
                                  ? setEditingReminder({ id: event.id, type: event.type, dueDate: event.date, notes: event.notes })
                                  : setEditingLog({ id: event.id, type: event.type, date: event.date, notes: event.notes })
                                }
                                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                aria-label="Edit"
                              ><Pencil className="w-3 h-3" /></button>
                            )}
                            <button
                              onClick={() => isReminder ? handleDeleteReminder(event.id) : handleDeleteLog(event.id)}
                              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              aria-label="Delete"
                            ><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                        {event.notes && (
                          <p className={`text-sm mt-2 ${isReminder && isCompleted ? 'line-through text-muted-foreground/60' : isStatusChange ? 'text-amber-700/80 dark:text-amber-400/80 font-medium' : 'text-muted-foreground'}`}>
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

          {/* Care Journal full-screen overlay */}
          {careExpanded && (
            <div
              className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200"
              role="dialog"
              aria-modal="true"
              aria-label="Care Journal — full view"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b bg-card shrink-0">
                <div className="flex items-center gap-2.5 text-primary">
                  <Scissors className="w-5 h-5" />
                  <div>
                    <h2 className="font-serif text-lg leading-tight">Care Journal</h2>
                    <p className="text-xs text-muted-foreground">{tree.name} · {filteredTimeline?.length ?? 0} entr{filteredTimeline?.length === 1 ? 'y' : 'ies'}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <Dialog open={isLogOpen} onOpenChange={setIsLogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="secondary" size="sm"><Scissors className="w-4 h-4 mr-2" /> Log Care</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Add Care Log</DialogTitle></DialogHeader>
                        <LogForm treeId={tree.id} onSuccess={() => setIsLogOpen(false)} />
                      </DialogContent>
                    </Dialog>
                    <Dialog open={isReminderOpen} onOpenChange={setIsReminderOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm"><Calendar className="w-4 h-4 mr-2" /> Plan</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Schedule Care</DialogTitle></DialogHeader>
                        <ReminderForm treeId={tree.id} onSuccess={() => setIsReminderOpen(false)} />
                      </DialogContent>
                    </Dialog>
                    <button
                      onClick={() => setCareExpanded(false)}
                      className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      aria-label="Close full-screen care journal"
                    ><X className="w-5 h-5" /></button>
                  </div>
                  <div className="flex rounded-md border overflow-hidden text-xs font-medium">
                    {(["all", "completed", "planned"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setCareFilter(f)}
                        className={`px-3 py-1.5 capitalize transition-colors ${careFilter === f ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-6 max-w-4xl w-full mx-auto">
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                  {filteredTimeline?.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground text-sm italic">
                      {careFilter === "all" ? "The pages are blank. Start logging care." : `No ${careFilter} entries.`}
                    </div>
                  )}
                  {filteredTimeline?.map((event) => {
                    const isReminder = event.kind === "reminder";
                    const isCompleted = isReminder && event.completed;
                    const isStatusChange = event.kind === "log" && event.type === "Status Change";
                    const date = parseISO(event.date);
                    return (
                      <div key={event.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-card shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10 ${isStatusChange ? "text-amber-500" : "text-primary"}`}>
                          {isReminder ? (
                            <button onClick={() => handleToggleReminder(event.id, !event.completed)} className="hover:text-primary transition-colors focus:outline-none">
                              {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5 opacity-50 hover:opacity-100" />}
                            </button>
                          ) : isStatusChange ? (
                            <Activity className="w-4 h-4" />
                          ) : (
                            <Leaf className="w-4 h-4 opacity-70" />
                          )}
                        </div>
                        <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border bg-card shadow-sm transition-all hover:shadow-md ${isStatusChange ? "border-amber-200 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-900/10" : ""}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`font-medium ${isReminder && !isCompleted ? 'text-primary' : isStatusChange ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>
                              {isStatusChange ? "Health Status Changed" : event.type} {isReminder && !isCompleted && "(Planned)"}
                            </span>
                            <div className="flex items-center gap-1">
                              <time className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                                {format(date, 'MMM d, yyyy')}
                              </time>
                              {!isStatusChange && (
                                <button
                                  onClick={() => isReminder
                                    ? setEditingReminder({ id: event.id, type: event.type, dueDate: event.date, notes: event.notes })
                                    : setEditingLog({ id: event.id, type: event.type, date: event.date, notes: event.notes })
                                  }
                                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                  aria-label="Edit"
                                ><Pencil className="w-3 h-3" /></button>
                              )}
                              <button
                                onClick={() => isReminder ? handleDeleteReminder(event.id) : handleDeleteLog(event.id)}
                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                aria-label="Delete"
                              ><Trash2 className="w-3 h-3" /></button>
                            </div>
                          </div>
                          {event.notes && (
                            <p className={`text-sm mt-2 ${isReminder && isCompleted ? 'line-through text-muted-foreground/60' : isStatusChange ? 'text-amber-700/80 dark:text-amber-400/80 font-medium' : 'text-muted-foreground'}`}>
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
          )}
        </div>
      </div>

      {/* Edit log dialog */}
      <Dialog open={!!editingLog} onOpenChange={(open) => { if (!open) setEditingLog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Care Log</DialogTitle>
          </DialogHeader>
          {editingLog && (
            <LogForm
              treeId={tree.id}
              initialData={editingLog}
              onSuccess={() => setEditingLog(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit reminder dialog */}
      <Dialog open={!!editingReminder} onOpenChange={(open) => { if (!open) setEditingReminder(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Reminder</DialogTitle>
          </DialogHeader>
          {editingReminder && (
            <ReminderForm
              treeId={tree.id}
              initialData={editingReminder}
              onSuccess={() => setEditingReminder(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
