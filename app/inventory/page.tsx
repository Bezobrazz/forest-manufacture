"use client";

import Link from "next/link";
import {
  getInventory,
  getInventoryTransactions,
  getProducts,
} from "@/app/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package, ArrowUp, ArrowDown, Settings } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { InventoryAdjustForm } from "@/components/inventory-adjust-form";
import { InventoryShipForm } from "@/components/inventory-ship-form";
import { useEffect, useState } from "react";
import type { Inventory, InventoryTransaction, Product } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingSkeleton() {
  return (
    <div className="container py-6 space-y-8">
      <div className="flex items-center gap-1">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-16" />
      </div>

      <div>
        <Skeleton className="h-10 w-64 mb-2" />
        <Skeleton className="h-6 w-96" />
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <div>
                      <Skeleton className="h-5 w-32 mb-1" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-5 w-5 mt-1" />
                    <div>
                      <Skeleton className="h-5 w-32 mb-1" />
                      <Skeleton className="h-4 w-48 mb-1" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-20 w-full" />
                </div>
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-20 w-full" />
                </div>
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      console.log("Loading inventory data...");
      const [inventoryData, transactionsData, productsData] = await Promise.all(
        [getInventory(), getInventoryTransactions(), getProducts()]
      );
      console.log("Loaded transactions:", transactionsData);
      setInventory(inventoryData);
      setTransactions(transactionsData);
      setProducts(productsData);
      setIsLoading(false);
    }
    loadData();
  }, []);

  // Групуємо інвентар за категоріями
  const inventoryByCategory: Record<string, Inventory[]> = {};

  inventory.forEach((item) => {
    const categoryName = item.product?.category?.name || "Без категорії";
    if (!inventoryByCategory[categoryName]) {
      inventoryByCategory[categoryName] = [];
    }
    inventoryByCategory[categoryName].push(item);
  });

  // Сортуємо категорії за алфавітом
  const sortedCategories = Object.keys(inventoryByCategory).sort();

  // Функція для отримання номера фракції з опису продукту
  function getFractionNumber(productDescription?: string): number {
    if (!productDescription) return 999;
    const match = productDescription.match(/(\d)\s*фракц/i);
    if (match) {
      return parseInt(match[1], 10);
    }
    return 999; // Якщо не знайдено, ставимо в кінець
  }

  console.log("InventoryPage render", { transactions, isLoading });

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="container py-6">
      <div className="mb-6">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Назад</span>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Управління складом</h1>
        <p className="text-muted-foreground">
          Перегляд та управління запасами продукції на складі
        </p>
      </div>

      <Tabs defaultValue="inventory" className="space-y-6">
        <TabsList className="flex py-4 flex-col gap-2 max-w-xs w-full bg-muted p-2 rounded-lg mx-auto my-4 shadow-sm sm:flex-row sm:w-full sm:max-w-none">
          <TabsTrigger value="inventory" className="w-full">
            Поточні запаси
          </TabsTrigger>
          <TabsTrigger value="transactions" className="w-full">
            Історія операцій
          </TabsTrigger>
          <TabsTrigger value="management" className="w-full">
            Управління складом
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-6">
          {sortedCategories.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <p className="text-muted-foreground">
                    Немає даних про запаси на складі
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            sortedCategories.map((category) => (
              <Card key={category}>
                <CardHeader className="pb-2">
                  <CardTitle>{category}</CardTitle>
                  <CardDescription>
                    Кількість продукції на складі
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {inventoryByCategory[category]
                      .slice()
                      .sort(
                        (a, b) =>
                          getFractionNumber(
                            a.product?.description ?? undefined
                          ) -
                          getFractionNumber(b.product?.description ?? undefined)
                      )
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between py-2 border-b last:border-0"
                        >
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">
                                {item.product?.name}
                              </div>
                              {item.product?.description && (
                                <div className="text-sm text-muted-foreground">
                                  {item.product.description}
                                </div>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant={
                              item.quantity > 0 ? "default" : "destructive"
                            }
                            className="ml-2"
                          >
                            {item.quantity} шт
                          </Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Історія операцій</CardTitle>
              <CardDescription>Лог операцій зі складом</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Немає даних про операції
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-start justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex items-start gap-3">
                        {transaction.transaction_type === "production" ? (
                          <ArrowUp className="h-5 w-5 text-green-500 mt-1" />
                        ) : transaction.transaction_type === "shipment" ? (
                          <ArrowDown className="h-5 w-5 text-red-500 mt-1" />
                        ) : (
                          <Settings className="h-5 w-5 text-blue-500 mt-1" />
                        )}
                        <div>
                          <div className="font-medium">
                            {transaction.transaction_type === "production"
                              ? "Виробництво"
                              : transaction.transaction_type === "shipment"
                              ? "Відвантаження"
                              : "Коригування"}
                          </div>
                          <div className="text-sm">
                            {transaction.product?.name}{" "}
                            <span className="text-muted-foreground">
                              (
                              {transaction.product?.category?.name ||
                                "Без категорії"}
                              )
                            </span>
                          </div>
                          {transaction.notes && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {transaction.notes}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatDateTime(transaction.created_at)}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={
                          transaction.quantity > 0 ? "default" : "destructive"
                        }
                        className="ml-2 whitespace-nowrap"
                      >
                        {transaction.quantity > 0 ? "+" : ""}
                        {transaction.quantity} шт
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="management" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-green-500">
                  Відвантаження продукції
                </CardTitle>
                <CardDescription>
                  Відвантаження продукції зі складу
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InventoryShipForm
                  inventory={inventory}
                  onInventoryUpdated={async () => {
                    const [newInventory, newTransactions] = await Promise.all([
                      getInventory(),
                      getInventoryTransactions(),
                    ]);
                    setInventory(newInventory);
                    setTransactions(newTransactions);
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-red-500">
                  Коригування кількості
                </CardTitle>
                <CardDescription>
                  Ручне коригування кількості продукції на складі
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InventoryAdjustForm products={products} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
