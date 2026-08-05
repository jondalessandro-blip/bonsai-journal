import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
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

const BONSAI_STAGES = [
  "Establishment",
  "Trunk Development",
  "Primary Branch Development",
  "Ramification & Refinement",
] as const;

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  species: z.string().optional(),
  acquiredDate: z.string().optional(),
  climate: z.string().optional(),
  foliage: z.string().optional(),
  style: z.string().optional(),
  stage: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface TreeFormProps {
  initialData?: Tree;
  onSuccess?: () => void;
}

export function TreeForm({ initialData, onSuccess }: TreeFormProps) {
  const [_, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);

  const createTree = useCreateTree();
  const updateTree = useUpdateTree();

  const isEdit = !!initialData;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      species: initialData?.species || "",
      acquiredDate: initialData?.acquiredDate ? initialData.acquiredDate.split('T')[0] : "",
      climate: initialData?.climate || "",
      foliage: initialData?.foliage || "",
      style: initialData?.style || "",
      stage: initialData?.stage || "",
      notes: initialData?.notes || "",
    },
  });

  const onSubmit = (values: FormValues) => {
    // Strip empty strings so they arrive as undefined (no-op on existing value)
    const clean = {
      ...Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "")),
      tags,
    } as FormValues & { tags: string[] };

    if (isEdit) {
      updateTree.mutate(
        { id: initialData.id, data: clean },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/trees", initialData.id] });
            queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
            if (onSuccess) onSuccess();
          },
        }
      );
    } else {
      createTree.mutate(
        { data: clean },
        {
          onSuccess: (tree) => {
            queryClient.invalidateQueries({ queryKey: ["/api/trees"] });
            if (onSuccess) {
              onSuccess();
            } else {
              setLocation(`/trees/${tree.id}`);
            }
          },
        }
      );
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            name="stage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Development Stage</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select climate" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Hardy / Outdoor">Hardy / Outdoor</SelectItem>
                    <SelectItem value="Tropical & Subtropical">Tropical & Subtropical</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="foliage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Foliage Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select foliage type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Deciduous">Deciduous</SelectItem>
                    <SelectItem value="Conifer">Conifer</SelectItem>
                    <SelectItem value="Broadleaf Evergreen">
                      <span className="hidden sm:inline">Broadleaf Evergreen</span>
                      <span className="sm:hidden">Broadleaf Evergr.</span>
                    </SelectItem>
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
                <BonsaiStylePicker
                  value={field.value}
                  onChange={field.onChange}
                />
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

        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="submit"
            disabled={createTree.isPending || updateTree.isPending}
          >
            {isEdit ? "Save Changes" : "Plant Tree"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
