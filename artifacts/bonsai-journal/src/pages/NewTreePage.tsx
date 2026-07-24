import { TreeForm } from "@/components/TreeForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Leaf } from "lucide-react";

export default function NewTreePage() {
  return (
    <div className="max-w-2xl mx-auto py-8 animate-in fade-in duration-500">
      <Card className="border-primary/10">
        <CardHeader className="text-center pb-8 border-b bg-muted/20">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Leaf className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-3xl font-serif">Plant a New Seed</CardTitle>
          <CardDescription className="text-base mt-2">
            Record the details of a new addition to your collection.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
          <TreeForm />
        </CardContent>
      </Card>
    </div>
  );
}
