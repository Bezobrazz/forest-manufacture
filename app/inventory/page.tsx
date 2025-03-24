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

export default async function InventoryPage() {
  const [inventory, transactions, products] = await Promise.all([
    getInventory(),
    getInventoryTransactions(),
    getProducts(),
  ]);

  console.log("inventory", inventory);
  console.log("transactions", transactions);
  console.log("products", products);

  // Групуємо інвентар за категоріями
  const inventoryByCategory: Record<string, typeof inventory> = {};

  inventory.forEach((item) => {
    const categoryName = item.product?.category?.name || "Без категорії";
    if (!inventoryByCategory[categoryName]) {
      inventoryByCategory[categoryName] = [];
    }
    inventoryByCategory[categoryName].push(item);
  });

  // Сортуємо категорії за алфавітом
  const sortedCategories = Object.keys(inventoryByCategory).sort();

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
        <TabsList>
          <TabsTrigger value="inventory">Поточні запаси</TabsTrigger>
          <TabsTrigger value="transactions">Історія операцій</TabsTrigger>
          <TabsTrigger value="management">Управління складом</TabsTrigger>
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
                    {inventoryByCategory[category].map((item) => (
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
            <CardHeader className="pb-2">
              <CardTitle>Історія операцій</CardTitle>
              <CardDescription>Всі операції зі складом</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">
                    Немає даних про операції зі складом
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
                <CardTitle>Коригування кількості</CardTitle>
                <CardDescription>
                  Ручне коригування кількості продукції на складі
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InventoryAdjustForm products={products} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Відвантаження продукції</CardTitle>
                <CardDescription>
                  Відвантаження продукції зі складу
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InventoryShipForm inventory={inventory} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
