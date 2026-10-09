"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DubrovytsiaBalanceSection() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Баланс Дубровиця</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Розділ у підготовці. Дані з’являться після наступного налаштування.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
