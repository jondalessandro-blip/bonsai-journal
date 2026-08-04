import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tree } from "@workspace/api-client-react/src/generated/api.schemas";
import { useCreateTree, useUpdateTree } from "@workspace/api-client-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { usePhotoUpload } from "@/hooks/use-photo-upload";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  species: z.string().optional(),
  acquiredDate: z.string().optional(),
  climate: z.string().optional(),
  foliage: z.string().optional(),
  style: z.string().optional(),
  photoUrl: z.string().optional().or(z.literal("")),
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialData?.photoUrl ?? null);

  const { uploadPhoto, isUploading, progress, error: uploadError } = usePhotoUpload();
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
      photoUrl: initialData?.photoUrl || "",
      notes: initialData?.notes || "",
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show a local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    const result = await uploadPhoto(file);
    if (result) {
      form.setValue("photoUrl", result.serveUrl);
      // Replace local blob URL with the real served URL
      setPreviewUrl(result.serveUrl);
    } else {
      // Upload failed — revert preview
      setPreviewUrl(initialData?.photoUrl ?? null);
    }
  };

  const handleRemovePhoto = () => {
    setPreviewUrl(null);
    form.setValue("photoUrl", "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = (values: FormValues) => {
    const data = {
      ...values,
      photoUrl: values.photoUrl === "" ? undefined : values.photoUrl,
    };

    if (isEdit) {
      updateTree.mutate(
        { id: initialData.id, data },
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
        { data },
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
                <FormControl>
                  <Input placeholder="e.g. Informal Upright, Cascade" {...field} />
                </FormControl>
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

        {/* Photo upload */}
        <div className="space-y-2">
          <FormLabel>Photo</FormLabel>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {previewUrl ? (
            <div className="relative inline-block">
              <img
                src={previewUrl}
                alt="Preview"
                className="h-48 w-48 object-cover rounded-lg border shadow-sm"
              />
              {isUploading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-black/50 text-white text-xs gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{progress}%</span>
                </div>
              )}
              {!isUploading && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-white shadow hover:bg-destructive/80 transition-colors"
                  aria-label="Remove photo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex h-48 w-48 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <ImagePlus className="w-6 h-6" />
              )}
              <span className="text-xs">{isUploading ? `Uploading ${progress}%` : "Choose photo"}</span>
            </button>
          )}

          {uploadError && (
            <p className="text-sm text-destructive">{uploadError}</p>
          )}

          {/* Keep the hidden field in the form */}
          <FormField
            control={form.control}
            name="photoUrl"
            render={({ field }) => <input type="hidden" {...field} />}
          />
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
            disabled={createTree.isPending || updateTree.isPending || isUploading}
          >
            {isEdit ? "Save Changes" : "Plant Tree"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
