import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateTreeReminder, useUpdateTreeReminder, useCreateTreeLog, useDeleteTreeReminder } from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CareEventMultiSelect } from "@/components/CareEventMultiSelect";
import { CARE_EVENT_TYPES } from "@/lib/care-events";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { useState } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const formSchema = z.object({
  types: z.array(z.string()).min(1, "Select at least one care event"),
  dueDate: z.string().min(1, "Due date is required"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ReminderFormProps {
  treeId: string;
  onSuccess: () => void;
  /** Provide to put the form into edit mode */
  initialData?: { id: string; type: string; dueDate: string; notes?: string | null };
}

export function ReminderForm({ treeId, onSuccess, initialData }: ReminderFormProps) {
  const queryClient = useQueryClient();
  const createReminder = useCreateTreeReminder();
  const updateReminder = useUpdateTreeReminder();
  const createLog = useCreateTreeLog();
  const deleteReminder = useDeleteTreeReminder();

  const isEdit = !!initialData;

  // "Complete task" workflow state
  const [completedChecked, setCompletedChecked] = useState(false);
  const [performedDate, setPerformedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      types: [initialData?.type ?? "Watering"],
      dueDate: initialData?.dueDate
        ? initialData.dueDate.split("T")[0]
        : format(addDays(new Date(), 7), "yyyy-MM-dd"),
      notes: initialData?.notes ?? "",
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "reminders"] });
    queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "timeline"] });
    queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "logs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/reminders/upcoming"] });
  };

  // Normal save (create or update reminder, no completion)
  const onSubmit = (values: FormValues) => {
    if (completedChecked && isEdit) {
      // Route to confirmation step instead
      setConfirmOpen(true);
      return;
    }
    if (isEdit) {
      updateReminder.mutate(
        {
          id: treeId,
          reminderId: initialData.id,
          data: {
            type: values.types[0],
            dueDate: values.dueDate,
            notes: values.notes,
          },
        },
        { onSuccess: () => { invalidateAll(); onSuccess(); } }
      );
    } else {
      setSubmitError(null);
      setIsScheduling(true);
      Promise.all(
        values.types.map((type) =>
          createReminder.mutateAsync({
            id: treeId,
            data: {
              type,
              dueDate: values.dueDate,
              notes: values.notes || undefined,
            },
          })
        )
      )
        .then(() => {
          invalidateAll();
          form.reset();
          onSuccess();
        })
        .catch(() => {
          setSubmitError("Could not schedule all selected care events. Please try again.");
        })
        .finally(() => setIsScheduling(false));
    }
  };

  // Complete workflow: log → delete reminder
  const handleConfirmComplete = () => {
    const values = form.getValues();
    setSubmitError(null);
    setIsCompleting(true);

    createLog.mutate(
      {
        id: treeId,
        data: {
          type: values.types[0],
          date: performedDate,
          notes: values.notes || undefined,
        },
      },
      {
        onSuccess: () => {
          // Log saved — now delete the original reminder
          deleteReminder.mutate(
            { id: treeId, reminderId: initialData!.id },
            {
              onSuccess: () => {
                invalidateAll();
                setIsCompleting(false);
                onSuccess();
              },
              onError: () => {
                // Log created but reminder deletion failed — still treat as success
                // (rare edge case; the reminder will remain but the log is saved)
                invalidateAll();
                setIsCompleting(false);
                onSuccess();
              },
            }
          );
        },
        onError: () => {
          setSubmitError(
            "Could not save the care log. The planned care item has not been changed — please try again."
          );
          setIsCompleting(false);
          setConfirmOpen(false);
        },
      }
    );
  };

  const isSaving = isScheduling || createReminder.isPending || updateReminder.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

        {/* Type + Due Date */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="types"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Task</FormLabel>
                {isEdit ? (
                  <Select onValueChange={(value) => field.onChange([value])} value={field.value?.[0]}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CARE_EVENT_TYPES.map((event) => (
                        <SelectItem key={event} value={event}>{event}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <FormControl>
                    <CareEventMultiSelect
                      value={field.value ?? []}
                      onChange={field.onChange}
                    />
                  </FormControl>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Specific instructions..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Complete task section (edit mode only) ── */}
        {isEdit && (
          <div className={`rounded-lg border transition-colors ${
            completedChecked
              ? "border-primary/30 bg-primary/5"
              : "border-border/50 bg-muted/30"
          } p-4 space-y-3`}>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <Checkbox
                checked={completedChecked}
                onCheckedChange={(checked) => {
                  setCompletedChecked(!!checked);
                  setConfirmOpen(false);
                  setSubmitError(null);
                }}
                id="task-completed"
              />
              <span className={`text-sm font-medium ${completedChecked ? "text-primary" : "text-muted-foreground"}`}>
                Task completed
              </span>
            </label>

            {completedChecked && (
              <div className="space-y-2 pl-7">
                <label htmlFor="performed-date" className="text-xs font-medium text-foreground block">
                  Date performed <span className="text-destructive">*</span>
                </label>
                <Input
                  id="performed-date"
                  type="date"
                  value={performedDate}
                  max={format(new Date(), "yyyy-MM-dd")}
                  onChange={(e) => setPerformedDate(e.target.value)}
                  className="h-8 text-sm"
                  required
                />
                <p className="text-[11px] text-muted-foreground leading-tight">
                  A care log entry will be created and this planned task removed.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {submitError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* ── Confirmation step ── */}
        {confirmOpen ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 space-y-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <p className="text-sm text-foreground leading-snug">
                This will permanently log{" "}
                <strong>{form.getValues("types").join(", ")}</strong> on{" "}
                <strong>{performedDate}</strong> and remove this planned care item.
                This cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmOpen(false)}
                disabled={isCompleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmComplete}
                disabled={isCompleting || !performedDate}
                className="gap-1.5"
              >
                {isCompleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isCompleting ? "Saving…" : "Yes, complete it"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isSaving || (completedChecked && !performedDate)}
              className={completedChecked ? "gap-1.5" : ""}
            >
              {completedChecked ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Complete &amp; Log Care
                </>
              ) : isEdit ? (
                "Save Changes"
              ) : (
                "Set Reminder"
              )}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
