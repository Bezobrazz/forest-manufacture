"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { getMaterials, getProductCategories } from "@/app/actions";
import { MaterialForm } from "@/components/material-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Tag } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MaterialList } from "@/components/material-list";
import { DeleteCategoryButton } from "@/components/delete-category-button";
import { CategoryForm } from "@/components/category-form";
import { DatabaseError } from "@/components/database-error";
import { Box } from "lucide-react";
import type { Product, ProductCategory } from "@/lib/types";

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [databaseError, setDatabaseError] = useState(false);

  // Функція для завантаження даних
  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    setDatabaseError(false);

    try {
      const materialsData = await getMaterials();
      const categoriesData = await getProductCategories();

      setMaterials(materialsData);
      setCategories(categoriesData);
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

  // Функція для оновлення списку матеріалів
  const refreshMaterials = async () => {
    try {
      const updatedMaterials = await getMaterials();
      setMaterials(updatedMaterials);
    } catch (err) {
      console.error("Помилка при оновленні списку матеріалів:", err);
      setError("Не вдалося оновити список матеріалів.");
    }
  };

  // Функція для оновлення списку категорій
  const refreshCategories = async () => {
    try {
      const updatedCategories = await getProductCategories();
      setCategories(updatedCategories);
    } catch (err) {
      console.error("Помилка при оновленні списку категорій:", err);
      setError("Не вдалося оновити список категорій.");
    }
  };

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
        <div className="text-center py-8">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-current border-t-transparent rounded-full mb-4"></div>
          <p>Завантаження даних...</p>
        </div>
      ) : (
        <Tabs defaultValue="materials" className="space-y-6">
          <TabsList>
            <TabsTrigger value="materials">Матеріали</TabsTrigger>
            <TabsTrigger value="categories">Категорії</TabsTrigger>
          </TabsList>

          <TabsContent value="materials" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Виробничі матеріали</CardTitle>
                  <CardDescription>
                    Список всіх виробничих матеріалів у системі
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MaterialList
                    initialMaterials={materials}
                    categories={categories}
                    onRefresh={refreshMaterials}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Додати матеріал</CardTitle>
                  <CardDescription>
                    Додайте новий виробничий матеріал до системи
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MaterialForm
                    categories={categories}
                    onMaterialAdded={refreshMaterials}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="categories" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Категорії матеріалів</CardTitle>
                  <CardDescription>
                    Список категорій матеріалів у системі
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {categories.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground">
                        Немає зареєстрованих категорій
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {categories.map((category) => (
                        <div
                          key={category.id}
                          className="flex items-center justify-between py-2 border-b last:border-0"
                        >
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4 text-muted-foreground" />
                            <div className="font-medium">{category.name}</div>
                          </div>
                          <DeleteCategoryButton
                            categoryId={category.id}
                            categoryName={category.name}
                            onCategoryDeleted={refreshCategories}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Додати категорію</CardTitle>
                  <CardDescription>
                    Додайте нову категорію матеріалів
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CategoryForm onCategoryAdded={refreshCategories} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

