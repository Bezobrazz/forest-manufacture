"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { getSuppliers } from "@/app/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Truck, Search } from "lucide-react";
import { SuppliersTable } from "@/components/suppliers-table";
import { AddSupplierDialog } from "@/components/add-supplier-dialog";
import { DatabaseError } from "@/components/database-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Supplier } from "@/lib/types";

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="h-10 w-48" />
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 py-3 border-b">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-8 w-20 ml-auto" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [databaseError, setDatabaseError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date">("name");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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

  // Фільтрація та сортування постачальників
  const filteredAndSortedSuppliers = useMemo(() => {
    let filtered = suppliers.filter((supplier) => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;

      const nameMatch = supplier.name.toLowerCase().includes(query);
      const phoneMatch = supplier.phone?.toLowerCase().includes(query) || false;
      const notesMatch = supplier.notes?.toLowerCase().includes(query) || false;

      return nameMatch || phoneMatch || notesMatch;
    });

    // Сортування
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name, "uk");
      } else {
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
    });

    return filtered;
  }, [suppliers, searchQuery, sortBy]);

  // Розрахунок пагінації
  const totalPages = Math.ceil(
    filteredAndSortedSuppliers.length / itemsPerPage
  );
  const paginatedSuppliers = filteredAndSortedSuppliers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Функції для керування пагінацією
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToPage = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // Скидання пагінації при зміні пошуку або сортування
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy]);

  // Статистика
  const totalSuppliers = suppliers.length;
  const suppliersWithPhone = suppliers.filter((s) => s.phone).length;
  const suppliersWithNotes = suppliers.filter((s) => s.notes).length;

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Назад</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Truck className="h-6 w-6" />
              <h1 className="text-3xl font-bold">Постачальники</h1>
            </div>
            <Badge variant="secondary" className="text-sm">
              {totalSuppliers} {totalSuppliers === 1 ? "постачальник" : totalSuppliers < 5 ? "постачальники" : "постачальників"}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Управління постачальниками та їх контактною інформацією
          </p>
        </div>
        <AddSupplierDialog onSupplierAdded={refreshSuppliers} />
      </div>

      {/* Статистика */}
      {!isLoading && !databaseError && totalSuppliers > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Всього постачальників</CardDescription>
              <CardTitle className="text-2xl">{totalSuppliers}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>З номером телефону</CardDescription>
              <CardTitle className="text-2xl">{suppliersWithPhone}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>З примітками</CardDescription>
              <CardTitle className="text-2xl">{suppliersWithNotes}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {databaseError ? (
        <div className="py-8">
          <DatabaseError onRetry={loadData} />
        </div>
      ) : isLoading ? (
        <LoadingSkeleton />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle>Список постачальників</CardTitle>
                <CardDescription>
                  {filteredAndSortedSuppliers.length === totalSuppliers
                    ? `Показано всіх ${totalSuppliers} постачальників`
                    : `Показано ${filteredAndSortedSuppliers.length} з ${totalSuppliers} постачальників`}
                  {totalPages > 1 &&
                    ` • Сторінка ${currentPage} з ${totalPages}`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={sortBy}
                  onValueChange={(value) =>
                    setSortBy(value as "name" | "date")
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Сортувати за назвою</SelectItem>
                    <SelectItem value="date">Сортувати за датою</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => {
                    setItemsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 на сторінці</SelectItem>
                    <SelectItem value="10">10 на сторінці</SelectItem>
                    <SelectItem value="20">20 на сторінці</SelectItem>
                    <SelectItem value="50">50 на сторінці</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
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
            <SuppliersTable
              suppliers={paginatedSuppliers}
              onRefresh={refreshSuppliers}
            />
            {totalPages > 1 && (
              <div className="mt-6">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={(e) => {
                          e.preventDefault();
                          goToPreviousPage();
                        }}
                        href="#"
                        className={
                          currentPage === 1
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (page) => {
                        // Показуємо першу, останню, поточну та сусідні сторінки
                        const showPage =
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1);

                        if (!showPage) {
                          // Показуємо ellipsis
                          if (
                            (page === currentPage - 2 && currentPage > 3) ||
                            (page === currentPage + 2 &&
                              currentPage < totalPages - 2)
                          ) {
                            return (
                              <PaginationItem key={page}>
                                <PaginationEllipsis />
                              </PaginationItem>
                            );
                          }
                          return null;
                        }

                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={(e) => {
                                e.preventDefault();
                                goToPage(page);
                              }}
                              href="#"
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      }
                    )}
                    <PaginationItem>
                      <PaginationNext
                        onClick={(e) => {
                          e.preventDefault();
                          goToNextPage();
                        }}
                        href="#"
                        className={
                          currentPage === totalPages
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
