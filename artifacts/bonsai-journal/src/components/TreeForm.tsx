import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import type { Tree } from "@workspace/api-client-react";
import { useCreateTree, useUpdateTree } from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BonsaiStylePicker } from "@/components/BonsaiStylePicker";
import { TagInput } from "@/components/TagInput";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { Copy, Sprout } from "lucide-react";

const BONSAI_STAGES = [
  "Establishment",
  "Trunk Development",
  "Primary Branch Development",
  "Ramification & Refinement",
] as const;

const TREE_STATUSES = [
  "Thriving",
  "Dormant",
  "Stressed/In Distress",
  "Sick",
  "Dead/Beyond Recovery",
] as const;

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  species: z.string().optional(),
  acquiredDate: z.string().optional(),
  climate: z.string().optional(),
  foliage: z.string().optional(),
  style: z.string().optional(),
  stage: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

/** Fields that can be pre-populated when duplicating a tree (excludes identity/time-specific values). */
export type TreePrefillData = {
  species?: string;
  climate?: string;
  foliage?: string;
  style?: string;
  stage?: string;
  status?: string;
  notes?: string;
  tags?: string[];
};

export interface TreeFormHandle {
  submit: () => void;
}

interface TreeFormProps {
  initialData?: Tree;
  /** Pre-populated field values for a new tree (does not trigger edit mode). */
  prefillData?: TreePrefillData;
  onSuccess?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** Called after a successful save when the user chose "Plant Another Tree". */
  onPlantAnother?: () => void;
  /** Called after a successful save when the user chose "Add Duplicate Tree". */
  onDuplicate?: (savedTree: Tree) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a stable snapshot of all form fields + tags for dirty comparison. */
type Baseline = FormValues & { tags: string[] };

function buildDefaultValues(
  initialData: Tree | undefined,
  prefillData: TreePrefillData | undefined
): FormValues {
  return {
    name:         initialData?.name                                              ?? "",
    species:      initialData?.species      ?? prefillData?.species              ?? "",
    acquiredDate: initialData?.acquiredDate ? initialData.acquiredDate.split("T")[0] : "",
    climate:      initialData?.climate      ?? prefillData?.climate              ?? "",
    foliage:      initialData?.foliage      ?? prefillData?.foliage              ?? "",
    style:        initialData?.style        ?? prefillData?.style                ?? "",
    stage:        initialData?.stage        ?? prefillData?.stage                ?? "",
    status:       initialData?.status       ?? prefillData?.status               ?? "",
    notes:        initialData?.notes        ?? prefillData?.notes                ?? "",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export const TreeForm = forwardRef<TreeFormHandle, TreeFormProps>(function TreeForm(
  { initialData, prefillData, onSuccess, onDirtyChange, onPlantAnother, onDuplicate },
  ref
) {
  const [, setLocation] = useLocation();
  const queryClient    = useQueryClient();
  const isEdit         = !!initialData;

  const defaultValues = buildDefaultValues(initialData, prefillData);

  // Tags are managed outside react-hook-form
  const [tags, setTags] = useState<string[]>(
    initialData?.tags ?? prefillData?.tags ?? []
  );

  // ── Baseline — the "saved" state we compare against for dirty detection ──
  // Updated after every successful save so incremental edits are detected.
  const baselineRef = useRef<Baseline>({
    ...defaultValues,
    tags: initialData?.tags ?? prefillData?.tags ?? [],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  // ── Dirty detection via deep comparison (not form.formState.isDirty) ───────
  // useWatch subscribes to all field changes and re-renders only when a value
  // actually changes, which is more reliable than the isDirty proxy for
  // Radix Select (defaultValue/uncontrolled) and date inputs.
  const watched = useWatch({ control: form.control });

  const isDirty = (() => {
    const formKeys = Object.keys(defaultValues) as (keyof FormValues)[];
    const formChanged = formKeys.some(
      (k) => (watched as FormValues)[k] !== baselineRef.current[k]
    );
    const tagsChanged =
      JSON.stringify(tags) !== JSON.stringify(baselineRef.current.tags);
    return formChanged || tagsChanged;
  })();

  // Notify parent of dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Expose submit() for parent-triggered saves (e.g. dialog close guard)
  useImperativeHandle(ref, () => ({
    submit: () => form.handleSubmit(onSubmit)(),
  }));

  // Track which extra action was requested alongside the submit
  type PostSaveAction = "plantAnother" | "duplicate" | null;
  const pendingActionRef = useRef<PostSaveAction>(null);

  // Navigation guard state — only active for new-tree (full-page) form
  type GuardState = { path: string; resume: () => void };
  const [guardState, setGuardState] = useState<GuardState | null>(null);
  const pendingResumeRef = useRef<(() => void) | null>(null);

  useNavigationGuard(!isEdit && isDirty, (path, resume) => {
    setGuardState({ path, resume });
  });

  // ── Submit handler ────────────────────────────────────────────────────────
  const onSubmit = (values: FormValues) => {
    const clean = {
      ...Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "")),
      tags,
    } as FormValues & { tags: string[] };

    if (isEdit) {
      updateTree.mutate(
        { id: initialData.id, data: clean },
        {
          onSuccess: () => {
            // Advance the baseline so the form is clean relative to saved state
            baselineRef.current = { ...values, tags: [...tags] };
            form.reset(values);

            queryClient.invalidateQueries({ queryKey: ["/api/trees", initialData.id] });
            queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
            queryClient.invalidateQueries({ queryKey: ["/api/trees", initialData.id, "timeline"] });
            onSuccess?.();
          },
        }
      );
    } else {
      createTree.mutate(
        { data: clean },
        {
          onSuccess: (tree) => {
            baselineRef.current = { ...values, tags: [...tags] };
            form.reset(values);

            queryClient.invalidateQueries({ queryKey: ["/api/trees"] });

            const action = pendingActionRef.current;
            pendingActionRef.current = null;

            if (pendingResumeRef.current) {
              // "Save & Leave" from navigation guard — resume the blocked navigation
              pendingResumeRef.current();
              pendingResumeRef.current = null;
            } else if (action === "plantAnother") {
              onPlantAnother?.();
            } else if (action === "duplicate") {
              onDuplicate?.(tree);
            } else if (onSuccess) {
              onSuccess();
            } else {
              setLocation(`/trees/${tree.id}`);
            }
          },
        }
      );
    }
  };

  const createTree = useCreateTree();
  const updateTree = useUpdateTree();

  // ── Navigation guard dialog handlers (new-tree page) ──────────────────────
  const handleGuardSaveAndLeave = () => {
    if (!guardState) return;
    pendingResumeRef.current = guardState.resume;
    setGuardState(null);
    form.handleSubmit(onSubmit)();
  };

  const handleGuardDiscard = () => {
    if (!guardState) return;
    const { resume } = guardState;
    // Reset to baseline (the last saved state), not necessarily the very first defaultValues
    const { tags: baseTags, ...baseFormVals } = baselineRef.current;
    form.reset(baseFormVals as FormValues);
    setTags([...baseTags]);
    setGuardState(null);
    resume();
  };

  const handleGuardCancel = () => setGuardState(null);

  const isBusy = createTree.isPending || updateTree.isPending;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <UnsavedChangesDialog
        open={guardState !== null}
        onSaveAndLeave={handleGuardSaveAndLeave}
        onDiscard={handleGuardDiscard}
        onCancel={handleGuardCancel}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 4 paired rows — collapses to 1-col on mobile.
              Row 1: Name | Species
              Row 2: Health Status | Development Stage
              Row 3: Climate Need | Acquired Date
              Row 4: Foliage Type | Bonsai Style (+ ⓘ button) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name / Identifier</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. The Old Elm, Specimen #01" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="species"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Species (Botanical or Common)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Acer palmatum" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Health Status</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TREE_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Development Stage</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select stage (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BONSAI_STAGES.map((s, i) => (
                        <SelectItem key={s} value={s}>
                          {i + 1}. {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="climate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Climate Need</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select climate" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Hardy / Outdoor">Hardy / Outdoor</SelectItem>
                      <SelectItem value="Tropical & Subtropical">Tropical &amp; Subtropical</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="acquiredDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Acquired Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Row 4: Foliage + Style side-by-side */}
            <FormField
              control={form.control}
              name="foliage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Foliage Type</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select foliage type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Deciduous">Deciduous</SelectItem>
                      <SelectItem value="Conifer">Conifer</SelectItem>
                      <SelectItem value="Broadleaf Evergreen">Broadleaf Evergreen</SelectItem>
                      <SelectItem value="Succulent / Desert">Succulent / Desert</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="style"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bonsai Style</FormLabel>
                  <BonsaiStylePicker value={field.value} onChange={field.onChange} />
                  <FormMessage />
                </FormItem>
              )}
            />

          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tags</label>
            <TagInput value={tags} onChange={setTags} />
            <p className="text-xs text-muted-foreground">Click a suggestion or type your own and press Enter</p>
          </div>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>General Notes (Markdown supported)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="History, specific care needs, origin story..."
                    className="min-h-[120px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
            {/* Secondary actions — new-tree mode only */}
            {!isEdit && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => {
                    pendingActionRef.current = "plantAnother";
                    form.handleSubmit(onSubmit)();
                  }}
                >
                  <Sprout className="w-4 h-4 mr-2" />
                  Plant Another Tree
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => {
                    pendingActionRef.current = "duplicate";
                    form.handleSubmit(onSubmit)();
                  }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Add Duplicate Tree
                </Button>
              </div>
            )}

            {/* Primary save */}
            <Button
              type="submit"
              disabled={isBusy}
              className={isEdit ? "" : "ml-auto"}
            >
              {isEdit ? "Save Changes" : "Plant Tree"}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
});
