import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateTreeLog, useUpdateTreeLog, useCreateTreeReminder, useDeleteTreeLog } from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { useState } from "react";
import { RotateCcw, AlertCircle, Loader2 } from "lucide-react";

const formSchema = z.object({
  type: z.string().min(1, "Type is required"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface LogFormProps {
  treeId: string;
  onSuccess: () => void;
  /** Provide to put the form into edit mode */
  initialData?: { id: string; type: string; date: string; notes?: string | null };
}

export function LogForm({ treeId, onSuccess, initialData }: LogFormProps) {
  const queryClient = useQueryClient();
  const createLog = useCreateTreeLog();
  const updateLog = useUpdateTreeLog();
  const createReminder = useCreateTreeReminder();
  const deleteLog = useDeleteTreeLog();

  const isEdit = !!initialData;

  // "Return to planned" workflow state
  const [returnChecked, setReturnChecked] = useState(false);
  const [plannedDate, setPlannedDate] = useState(
    format(addDays(new Date(), 7), "yyyy-MM-dd")
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: initialData?.type ?? "Watering",
      date: initialData?.date
        ? initialData.date.split("T")[0]
        : new Date().toISOString().split("T")[0],
      notes: initialData?.notes ?? "",
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "logs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "timeline"] });
    queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "reminders"] });
    queryClient.invalidateQueries({ queryKey: ["/api/reminders/upcoming"] });
  };

  // Normal save (create or update log, no move)
  const onSubmit = (values: FormValues) => {
    if (returnChecked && isEdit) {
      setConfirmOpen(true);
      return;
    }
    if (isEdit) {
      updateLog.mutate(
        { id: treeId, logId: initialData.id, data: values },
        { onSuccess: () => { invalidateAll(); onSuccess(); } }
      );
    } else {
      createLog.mutate(
        { id: treeId, data: values },
        { onSuccess: () => { invalidateAll(); form.reset(); onSuccess(); } }
      );
    }
  };

  // Move workflow: create reminder → delete log
  const handleConfirmMove = () => {
    const values = form.getValues();
    setSubmitError(null);
    setIsMoving(true);

    createReminder.mutate(
      {
        id: treeId,
        data: {
          type: values.type,
          dueDate: plannedDate,
          notes: values.notes || undefined,
        },
      },
      {
        onSuccess: () => {
          // Reminder saved — now delete the original log entry
          deleteLog.mutate(
            { id: treeId, logId: initialData!.id },
            {
              onSuccess: () => {
                invalidateAll();
                setIsMoving(false);
                onSuccess();
              },
              onError: () => {
                // Reminder created but log deletion failed — still succeed
                invalidateAll();
                setIsMoving(false);
                onSuccess();
              },
            }
          );
        },
        onError: () => {
          setSubmitError(
            "Could not create the planned care reminder. This log entry has not been changed — please try again."
          );
          setIsMoving(false);
          setConfirmOpen(false);
        },
      }
    );
  };

  const isSaving = createLog.isPending || updateLog.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

        {/* Action + Date */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Action</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Watering">Watering</SelectItem>
                    <SelectItem value="Pruning">Pruning</SelectItem>
                    <SelectItem value="Repotting">Repotting</SelectItem>
                    <SelectItem value="Fertilizing">Fertilizing</SelectItem>
                    <SelectItem value="Wiring">Wiring</SelectItem>
                    <SelectItem value="Winter Prep">Winter Prep</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
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
                <Textarea placeholder="What was done? How did it respond?" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* ── Return to planned section (edit mode only) ── */}
        {isEdit && (
          <div className={`rounded-lg border transition-colors ${
            returnChecked
              ? "border-amber-400/40 bg-amber-50/60 dark:bg-amber-950/20"
              : "border-border/50 bg-muted/30"
          } p-4 space-y-3`}>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <Checkbox
                checked={returnChecked}
                onCheckedChange={(checked) => {
                  setReturnChecked(!!checked);
                  setConfirmOpen(false);
                  setSubmitError(null);
                }}
                id="return-to-planned"
              />
              <span className={`text-sm font-medium ${
                returnChecked ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
              }`}>
                Return to planned
              </span>
            </label>

            {returnChecked && (
              <div className="space-y-2 pl-7">
                <label htmlFor="planned-date" className="text-xs font-medium text-foreground block">
                  Planned due date <span className="text-destructive">*</span>
                </label>
                <Input
                  id="planned-date"
                  type="date"
                  value={plannedDate}
                  min={format(new Date(), "yyyy-MM-dd")}
                  onChange={(e) => setPlannedDate(e.target.value)}
                  className="h-8 text-sm"
                  required
                />
                <p className="text-[11px] text-muted-foreground leading-tight">
                  A planned care reminder will be created and this log entry removed.
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
          <div className="rounded-lg border border-amber-400/40 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3 space-y-3">
            <div className="flex items-start gap-2">
              <RotateCcw className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-sm text-foreground leading-snug">
                This will create a planned reminder for{" "}
                <strong>{form.getValues("type")}</strong> due{" "}
                <strong>{plannedDate}</strong> and permanently remove this care log entry.
                This cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmOpen(false)}
                disabled={isMoving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleConfirmMove}
                disabled={isMoving || !plannedDate}
                className="gap-1.5"
              >
                {isMoving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isMoving ? "Moving…" : "Yes, move to planned"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isSaving || (returnChecked && !plannedDate)}
              className={returnChecked ? "gap-1.5" : ""}
              variant={returnChecked ? "secondary" : "default"}
            >
              {returnChecked ? (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Move to Planned
                </>
              ) : isEdit ? (
                "Save Changes"
              ) : (
                "Add Log Entry"
              )}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
