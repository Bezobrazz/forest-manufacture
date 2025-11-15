"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { getSuppliers } from "@/app/actions";
import { SupplierForm } from "@/components/supplier-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Truck, Search } from "lucide-react";
import { SupplierList } from "@/components/supplier-list";
import { DatabaseError } from "@/components/database-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import type { Supplier } from "@/lib/types";

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <div>
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-52 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [databaseError, setDatabaseError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Функція для завантаження даних
  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    setDatabaseError(false);

    try {
      const suppliersData = await getSuppliers();
      setSuppliers(suppliersData);
    } catch (err: any) {
      console.error("Помилка при завантаженні даних:", err);

      // Перевіряємо, чи це помилка підключення до бази даних
      if (
        err?.message?.includes("Supabase") ||
        err?.message?.includes("credentials")
      ) {
        setDatabaseError(true);
      } else {
        setError("Не вдалося завантажити дані. Будь ласка, спробуйте пізніше.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Завантажуємо дані при першому рендері
  useEffect(() => {
    loadData();
  }, []);

  // Функція для оновлення списку постачальників
  const refreshSuppliers = async () => {
    try {
      const updatedSuppliers = await getSuppliers();
      setSuppliers(updatedSuppliers);
    } catch (err) {
      console.error("Помилка при оновленні списку постачальників:", err);
      setError("Не вдалося оновити список постачальників.");
    }
  };

  // Фільтрація постачальників за пошуковим запитом
  const filteredSuppliers = suppliers.filter((supplier) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    const nameMatch = supplier.name.toLowerCase().includes(query);
    const phoneMatch = supplier.phone?.toLowerCase().includes(query) || false;
    const notesMatch = supplier.notes?.toLowerCase().includes(query) || false;

    return nameMatch || phoneMatch || notesMatch;
  });

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

      {databaseError ? (
        <div className="py-8">
          <DatabaseError onRetry={loadData} />
        </div>
      ) : isLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Постачальники
              </CardTitle>
              <CardDescription>
                Список всіх постачальників у системі
              </CardDescription>
            </CardHeader>
            <div className="px-6 pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Пошук по назві, телефону або примітках..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <CardContent>
              <SupplierList
                initialSuppliers={filteredSuppliers}
                onRefresh={refreshSuppliers}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Додати постачальника</CardTitle>
              <CardDescription>
                Додайте нового постачальника до системи
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SupplierForm />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

