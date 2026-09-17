import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateBulkTreeLogs } from "@workspace/api-client-react";
import { z } from "zod";
import { AlertCircle, Loader2 } from "lucide-react";
import { CareEventMultiSelect } from "@/components/CareEventMultiSelect";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  types: z.array(z.string()).min(1, "Select at least one care event"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface BulkLogFormProps {
  treeIds: string[];
  onSuccess: () => void;
}

export function BulkLogForm({ treeIds, onSuccess }: BulkLogFormProps) {
  const queryClient = useQueryClient();
  const createBulkLogs = useCreateBulkTreeLogs();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      types: [],
      date: new Date().toISOString().split("T")[0],
      notes: "",
    },
  });

  const invalidateAll = async () => {
    await Promise.all([
      ...treeIds.flatMap((treeId) => [
        queryClient.invalidateQueries({
          queryKey: ["/api/trees", treeId, "logs"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["/api/trees", treeId, "timeline"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["/api/trees", treeId, "reminders"],
        }),
      ]),
      queryClient.invalidateQueries({
        queryKey: ["/api/reminders/upcoming"],
      }),
    ]);
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await Promise.all(
        values.types.map((type) =>
          createBulkLogs.mutateAsync({
            data: {
              treeIds,
              type,
              date: values.date,
              notes: values.notes || undefined,
            },
          }),
        ),
      );
      await invalidateAll();
      onSuccess();
    } catch {
      setSubmitError(
        "Could not save all selected care events. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="types"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Action</FormLabel>
                <FormControl>
                  <CareEventMultiSelect
                    value={field.value ?? []}
                    onChange={field.onChange}
                    disabled={isSubmitting}
                  />
                </FormControl>
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
                  <Input type="date" disabled={isSubmitting} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  className="min-h-[120px]"
                  placeholder="What was done? How did it respond?"
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {submitError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting} className="gap-1.5">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? "Saving…" : "Add Log Entry"}
          </Button>
        </div>
      </form>
    </Form>
  );
}