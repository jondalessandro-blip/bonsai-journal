import { useState, useCallback } from "react";
import type { Tree } from "@workspace/api-client-react";
import { TreeForm } from "@/components/TreeForm";
import type { TreePrefillData } from "@/components/TreeForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Leaf } from "lucide-react";

/** Fields duplicated from a saved tree — excludes identity / time-specific values. */
function buildPrefill(tree: Tree): TreePrefillData {
  return {
    species: tree.species ?? undefined,
    climate:  tree.climate  ?? undefined,
    foliage:  tree.foliage  ?? undefined,
    style:    tree.style    ?? undefined,
    stage:    tree.stage    ?? undefined,
    status:   tree.status   ?? undefined,
    notes:    tree.notes    ?? undefined,
    tags:     tree.tags     ?? [],
  };
}

export default function NewTreePage() {
  // Incrementing the key forces TreeForm to remount with fresh state
  const [formKey, setFormKey] = useState(0);
  const [prefillData, setPrefillData] = useState<TreePrefillData | undefined>(undefined);

  const handlePlantAnother = useCallback(() => {
    setPrefillData(undefined);
    setFormKey((k) => k + 1);
  }, []);

  const handleDuplicate = useCallback((savedTree: Tree) => {
    setPrefillData(buildPrefill(savedTree));
    setFormKey((k) => k + 1);
  }, []);

  return (
    <div className="max-w-2xl mx-auto py-8 animate-in fade-in duration-500">
      <Card className="border-primary/10">
        <CardHeader className="text-center pb-8 border-b bg-muted/20">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Leaf className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-3xl font-serif">
            {prefillData ? "Add Duplicate Tree" : "Plant a New Seed"}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {prefillData
              ? "Review and edit the copied details, then save your new record."
              : "Record the details of a new addition to your collection."}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <TreeForm
            key={formKey}
            prefillData={prefillData}
            onPlantAnother={handlePlantAnother}
            onDuplicate={handleDuplicate}
          />
        </CardContent>
      </Card>
    </div>
  );
}
