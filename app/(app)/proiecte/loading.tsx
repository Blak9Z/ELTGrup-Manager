import { Skeleton } from "@/src/components/ui/skeleton";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeader title="Proiecte" subtitle="..." />
      
      <Card>
        <div className="space-y-4">
          <Skeleton className="h-8 w-[200px]" />
          <Skeleton className="h-4 w-full" />
          <div className="mt-4 flex gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:hidden">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="h-48">
            <Skeleton className="h-full w-full" />
          </Card>
        ))}
      </div>

      <Card className="hidden lg:block">
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}
