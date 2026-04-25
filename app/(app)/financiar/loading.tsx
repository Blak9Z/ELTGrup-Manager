import { Skeleton } from "@/src/components/ui/skeleton";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader title="Financiar operational" subtitle="..." />
      
      <div className="h-[400px]">
        <Skeleton className="h-full w-full rounded-xl" />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="h-28">
            <Skeleton className="h-full w-full" />
          </Card>
        ))}
      </div>

      <Card>
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}
