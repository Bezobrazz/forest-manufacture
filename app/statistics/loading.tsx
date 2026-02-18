import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="container py-6">
      <div className="mb-6">
        <Skeleton className="h-4 w-12" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Skeleton className="h-10 w-[120px]" />
          <Skeleton className="h-9 w-14" />
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-24 mb-4" />
              {(i === 1 || i === 3) && (
                <Skeleton className="h-10 w-full" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48 mb-2" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-full rounded-full mb-4" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-sm" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-44 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-2.5 w-full rounded-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40 mb-2" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {[1, 2].map((cat) => (
              <div key={cat} className="pt-2">
                <div className="flex items-center gap-2 mb-3">
                  <Skeleton className="h-3 w-3 rounded-sm" />
                  <Skeleton className="h-5 w-28" />
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                      <Skeleton className="h-8 w-full rounded-md" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
