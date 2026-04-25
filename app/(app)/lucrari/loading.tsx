import { Skeleton } from "@/src/components/ui/skeleton";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader title="Ordine de Lucru" subtitle="..." />
      
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="h-24">
            <Skeleton className="h-full w-full" />
          </Card>
        ))}
      </div>

      <Card>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}
