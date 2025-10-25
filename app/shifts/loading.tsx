import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="container py-6">
      <div className="mb-6">
        <div className="flex items-center gap-1">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between mb-6">
        <div className="flex items-center gap-4 mb-4 sm:mb-0">
          <Skeleton className="h-8 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Підсумок заробітної плати */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-muted p-4 rounded-lg">
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-8 w-24" />
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-8 w-16" />
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Список змін */}
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-6 w-24 mb-2" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-3" />
                <Skeleton className="h-4 w-32" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-3 w-40" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
