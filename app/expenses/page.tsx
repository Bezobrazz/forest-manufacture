"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, DollarSign, Trash2 } from "lucide-react";
import {
  getShifts,
  getExpenseCategories,
  createExpenseCategory,
  deleteExpenseCategory,
  getExpenses,
  createExpense,
  deleteExpense,
} from "@/app/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { DatabaseError } from "@/components/database-error";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import type { ShiftWithDetails } from "@/lib/types";

type PeriodFilter = "year" | "month" | "week";

interface ExpenseCategory {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

interface Expense {
  id: number;
  category_id: number;
  amount: number;
  description: string;
  date: string;
  created_at: string;
  category?: ExpenseCategory;
}

function LoadingSkeleton() {
  return (
    <div className="container py-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-6 w-96" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-16" />
              </div>
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function ExpensesPage() {
  const [period, setPeriod] = useState<PeriodFilter>("year");
  const [shifts, setShifts] = useState<ShiftWithDetails[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [databaseError, setDatabaseError] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newExpenseDescription, setNewExpenseDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setDatabaseError(false);

      try {
        const [shiftsData, categoriesData, expensesData] = await Promise.all([
          getShifts(),
          getExpenseCategories(),
          getExpenses(),
        ]);
        setShifts(shiftsData);
        setCategories(categoriesData);
        setExpenses(expensesData);
      } catch (err: any) {
        console.error("Помилка при завантаженні даних:", err);
        if (err?.message?.includes("Supabase")) {
          setDatabaseError(true);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const getStartDate = (period: PeriodFilter) => {
    const now = new Date();
    switch (period) {
      case "year":
        return new Date(now.getFullYear(), 0, 1);
      case "month":
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case "week":
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(now.setDate(diff));
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({
        title: "Помилка",
        description: "Назва категорії не може бути порожньою",
        variant: "destructive",
      });
      return;
    }

    try {
      const newCategory = await createExpenseCategory(
        newCategoryName,
        newCategoryDescription || null
      );
      setCategories([...categories, newCategory]);
      setNewCategoryName("");
      setNewCategoryDescription("");

      toast({
        title: "Успіх",
        description: "Категорію додано",
      });
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося додати категорію",
        variant: "destructive",
      });
    }
  };

  const handleAddExpense = async () => {
    if (!selectedCategory || !newExpenseAmount || !newExpenseDescription) {
      toast({
        title: "Помилка",
        description: "Всі поля мають бути заповнені",
        variant: "destructive",
      });
      return;
    }

    try {
      const newExpense = await createExpense(
        parseInt(selectedCategory),
        parseFloat(newExpenseAmount),
        newExpenseDescription
      );
      setExpenses([...expenses, newExpense]);
      setNewExpenseAmount("");
      setNewExpenseDescription("");
      setSelectedCategory("");

      toast({
        title: "Успіх",
        description: "Витрату додано",
      });
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося додати витрату",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCategory = async (categoryId: number) => {
    try {
      await deleteExpenseCategory(categoryId);
      setCategories(categories.filter((c) => c.id !== categoryId));
      setExpenses(expenses.filter((e) => e.category_id !== categoryId));

      toast({
        title: "Успіх",
        description: "Категорію видалено",
      });
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося видалити категорію",
        variant: "destructive",
      });
    }
  };

  const handleDeleteExpense = async (expenseId: number) => {
    try {
      await deleteExpense(expenseId);
      setExpenses(expenses.filter((e) => e.id !== expenseId));

      toast({
        title: "Успіх",
        description: "Витрату видалено",
      });
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося видалити витрату",
        variant: "destructive",
      });
    }
  };

  if (databaseError) {
    return (
      <div className="container py-12">
        <DatabaseError onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="container py-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href="/"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад
          </Link>
          <h1 className="text-3xl font-bold">Облік витрат</h1>
          <p className="text-muted-foreground">
            Управління витратами на виробництві
          </p>
        </div>

        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Додати категорію
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Нова категорія витрат</DialogTitle>
                <DialogDescription>
                  Додайте нову категорію для класифікації витрат
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Назва категорії</Label>
                  <Input
                    id="name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Наприклад: Матеріали"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Опис</Label>
                  <Input
                    id="description"
                    value={newCategoryDescription}
                    onChange={(e) => setNewCategoryDescription(e.target.value)}
                    placeholder="Опис категорії (необов'язково)"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddCategory}>Додати</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Додати витрату
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Нова витрата</DialogTitle>
                <DialogDescription>
                  Додайте нову витрату до обраної категорії
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Категорія</Label>
                  <Select
                    value={selectedCategory}
                    onValueChange={setSelectedCategory}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Оберіть категорію" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem
                          key={category.id}
                          value={category.id.toString()}
                        >
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Сума</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={newExpenseAmount}
                    onChange={(e) => setNewExpenseAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expenseDescription">Опис</Label>
                  <Input
                    id="expenseDescription"
                    value={newExpenseDescription}
                    onChange={(e) => setNewExpenseDescription(e.target.value)}
                    placeholder="Опис витрати"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddExpense}>Додати</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        {categories.map((category) => (
          <Card key={category.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{category.name}</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteCategory(category.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              {category.description && (
                <p className="text-sm text-muted-foreground">
                  {category.description}
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold">
                  {expenses
                    .filter((e) => e.category_id === category.id)
                    .reduce((sum, expense) => sum + expense.amount, 0)
                    .toLocaleString()}{" "}
                  ₴
                </div>
                <p className="text-xs text-muted-foreground">
                  {expenses.filter((e) => e.category_id === category.id).length}{" "}
                  витрат
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Історія витрат</h2>
        {expenses.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <p className="text-muted-foreground">
                  Немає зареєстрованих витрат
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          expenses.map((expense) => (
            <Card key={expense.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {expense.category?.name || "Без категорії"}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-bold">
                      {expense.amount.toLocaleString()} ₴
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteExpense(expense.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(expense.date)}
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{expense.description}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
