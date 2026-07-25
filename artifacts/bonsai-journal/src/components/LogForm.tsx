import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateTreeLog, useUpdateTreeLog } from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";

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
  const isEdit = !!initialData;

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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "logs"] });
    queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "timeline"] });
  };

  const onSubmit = (values: FormValues) => {
    if (isEdit) {
      updateLog.mutate(
        { id: treeId, logId: initialData.id, data: values },
        { onSuccess: () => { invalidate(); onSuccess(); } }
      );
    } else {
      createLog.mutate(
        { id: treeId, data: values },
        { onSuccess: () => { invalidate(); form.reset(); onSuccess(); } }
      );
    }
  };

  const isPending = createLog.isPending || updateLog.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isEdit ? "Save Changes" : "Add Log Entry"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
