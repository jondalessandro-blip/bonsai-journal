import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateTreeReminder } from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, format } from "date-fns";

const formSchema = z.object({
  type: z.string().min(1, "Type is required"),
  dueDate: z.string().min(1, "Due date is required"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function ReminderForm({ treeId, onSuccess }: { treeId: string; onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const createReminder = useCreateTreeReminder();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "Watering",
      dueDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
      notes: "",
    },
  });

  const onSubmit = (values: FormValues) => {
    createReminder.mutate(
      { id: treeId, data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "reminders"] });
          queryClient.invalidateQueries({ queryKey: ["/api/trees", treeId, "timeline"] });
          queryClient.invalidateQueries({ queryKey: ["/api/reminders/upcoming"] });
          form.reset();
          onSuccess();
        },
      }
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Task</FormLabel>
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
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
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
        <div className="flex justify-end">
          <Button type="submit" disabled={createReminder.isPending}>Set Reminder</Button>
        </div>
      </form>
    </Form>
  );
}
