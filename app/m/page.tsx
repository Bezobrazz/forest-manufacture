import Link from "next/link";
import { Package, Truck } from "lucide-react";

export default function MiniAppHomePage() {
  return (
    <div className="flex min-h-screen flex-col gap-4 p-4 pt-6">
      <div>
        <h1 className="text-2xl font-semibold">Польове внесення</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Закупівлі сировини та поїздки
        </p>
      </div>
      <Link
        href="/m/purchase"
        className="flex min-h-24 items-center gap-4 rounded-xl border bg-card p-5 text-left shadow-sm active:bg-accent"
      >
        <div className="rounded-full bg-primary/10 p-3">
          <Package className="h-7 w-7 text-primary" />
        </div>
        <div>
          <div className="text-lg font-medium">Закупівля сировини</div>
          <div className="text-sm text-muted-foreground">
            Постачальник, кількість, ціна
          </div>
        </div>
      </Link>
      <Link
        href="/m/trip"
        className="flex min-h-24 items-center gap-4 rounded-xl border bg-card p-5 text-left shadow-sm active:bg-accent"
      >
        <div className="rounded-full bg-primary/10 p-3">
          <Truck className="h-7 w-7 text-primary" />
        </div>
        <div>
          <div className="text-lg font-medium">Поїздка — сировина</div>
          <div className="text-sm text-muted-foreground">
            Транспорт, мішки, одометр
          </div>
        </div>
      </Link>
    </div>
  );
}
