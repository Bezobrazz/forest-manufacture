"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  DollarSign,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";
import {
  getShifts,
  getExpenseCategories,
  createExpenseCategory,
  deleteExpenseCategory,
  getExpenses,
  createExpense,
  deleteExpense,
  updateExpense,
  updateExpenseCategory,
  getSupplierDeliveries,
} from "@/app/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatDate, formatNumberWithUnit } from "@/lib/utils";
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
import { toast } from "sonner";
import type { ShiftWithDetails, SupplierDelivery } from "@/lib/types";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { uk } from "date-fns/locale";

type PeriodFilter = "year" | "month" | "week" | "day" | "custom";

const FILTER_PURCHASE = -1;
const FILTER_WAGES = -2;

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
  description: string | null;
  date: string;
  created_at: string;
  category?: ExpenseCategory;
}

interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
}

function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
}: DeleteConfirmationDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Скасувати
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Видалити
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
  const [period, setPeriod] = useState<PeriodFilter>("week");
  const [shifts, setShifts] = useState<ShiftWithDetails[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [supplierDeliveries, setSupplierDeliveries] = useState<
    SupplierDelivery[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [databaseError, setDatabaseError] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");
  const [newExpenseDescription, setNewExpenseDescription] = useState("");
  const [newExpenseDate, setNewExpenseDate] = useState<Date | undefined>(
    () => new Date()
  );
  const [newExpenseDatePickerOpen, setNewExpenseDatePickerOpen] =
    useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isAddExpenseDialogOpen, setIsAddExpenseDialogOpen] = useState(false);

  // Стани для пагінації
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);

  // Стани для модальних вікон підтвердження
  const [deleteCategoryDialog, setDeleteCategoryDialog] = useState<{
    isOpen: boolean;
    categoryId: number | null;
    categoryName: string;
  }>({
    isOpen: false,
    categoryId: null,
    categoryName: "",
  });

  const [deleteExpenseDialog, setDeleteExpenseDialog] = useState<{
    isOpen: boolean;
    expenseId: number | null;
    expenseAmount: number;
  }>({
    isOpen: false,
    expenseId: null,
    expenseAmount: 0,
  });

  // Стан для редагування витрати
  const [editExpenseDialog, setEditExpenseDialog] = useState<{
    isOpen: boolean;
    expense: Expense | null;
  }>({
    isOpen: false,
    expense: null,
  });

  // Стани для форми редагування
  const [editExpenseAmount, setEditExpenseAmount] = useState("");
  const [editExpenseDescription, setEditExpenseDescription] = useState("");
  const [editSelectedCategory, setEditSelectedCategory] = useState<string>("");

  // Стан для редагування категорії
  const [editCategoryDialog, setEditCategoryDialog] = useState<{
    isOpen: boolean;
    category: ExpenseCategory | null;
  }>({
    isOpen: false,
    category: null,
  });

  // Стани для форми редагування категорії
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryDescription, setEditCategoryDescription] = useState("");

  const [dateRange, setDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });

  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setDatabaseError(false);

      try {
        const [shiftsData, categoriesData, expensesData, deliveriesData] =
          await Promise.all([
            getShifts(),
            getExpenseCategories(),
            getExpenses(),
            getSupplierDeliveries(),
          ]);
        setShifts(shiftsData);
        setCategories(categoriesData);
        setExpenses(expensesData);
        setSupplierDeliveries(deliveriesData);
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

  const getStartDate = (period: PeriodFilter): Date => {
    const now = new Date();
    switch (period) {
      case "year":
        return new Date(now.getFullYear(), 0, 1);
      case "month":
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case "week": {
        const day = now.getDay();
        const saturdayOffset =
          day === 6 ? 0 : day === 0 ? -1 : -(day + 1);
        const startDate = new Date(now);
        startDate.setDate(now.getDate() + saturdayOffset);
        startDate.setHours(0, 0, 0, 0);
        return startDate;
      }
      case "day":
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      default:
        return now;
    }
  };

  const getEndDate = (period: PeriodFilter): Date => {
    const now = new Date();
    switch (period) {
      case "year":
        return new Date(now.getFullYear(), 11, 31);
      case "month":
        return new Date(now.getFullYear(), now.getMonth() + 1, 0);
      case "week": {
        const day = now.getDay();
        const fridayOffset = day === 5 ? 0 : day === 6 ? -1 : 5 - day;
        const endDate = new Date(now);
        endDate.setDate(now.getDate() + fridayOffset);
        endDate.setHours(23, 59, 59, 999);
        return endDate;
      }
      case "day": {
        const dayEnd = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        dayEnd.setHours(23, 59, 59, 999);
        return dayEnd;
      }
      default:
        return now;
    }
  };

  const toLocalDateOnly = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const isDateInRange = (date: Date) => {
    let startDate: Date;
    let endDate: Date;
    if (dateRange.from && dateRange.to) {
      startDate = new Date(dateRange.from);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(dateRange.to);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = getStartDate(period);
      endDate = getEndDate(period);
    }
    const t = toLocalDateOnly(date);
    return t >= toLocalDateOnly(startDate) && t <= toLocalDateOnly(endDate);
  };

  const parseDate = (value: string): Date => {
    if (!value) return new Date();
    if (value.includes("T")) return new Date(value);
    return new Date(value + "T12:00:00");
  };

  const filteredExpenses = expenses.filter((expense) => {
    const expenseDate = parseDate(expense.date);
    const dateFilter = isDateInRange(expenseDate);
    const categoryFilter =
      selectedCategories.length === 0 ||
      selectedCategories.includes(expense.category_id);
    return dateFilter && categoryFilter;
  });

  const purchaseExpenseItems = supplierDeliveries
    .filter((d) => Number(d.quantity) * Number(d.price_per_unit ?? 0) > 0)
    .map((d) => ({
      id: `delivery-${d.id}`,
      amount:
        Math.round(
          Number(d.quantity) * Number(d.price_per_unit ?? 0) * 100
        ) / 100,
      date: d.created_at,
      delivery: d,
    }));

  const filteredPurchaseExpenses = purchaseExpenseItems.filter((p) =>
    isDateInRange(parseDate(p.date))
  );

  const wageItems = shifts
    .filter((s) => s.status === "completed")
    .map((shift) => {
      const totalWage =
        shift.production?.reduce(
          (sum, item) =>
            sum +
            Number(item.quantity) * Number(item.product?.reward ?? 0),
          0
        ) ?? 0;
      return {
        id: `shift-${shift.id}`,
        amount: Math.round(totalWage * 100) / 100,
        date: shift.completed_at ?? shift.shift_date ?? shift.created_at,
        shift,
      };
    })
    .filter((w) => w.amount > 0);

  const filteredWageExpenses = wageItems.filter((w) =>
    isDateInRange(parseDate(w.date))
  );

  type HistoryItem =
    | { type: "expense"; expense: Expense }
    | { type: "purchase"; id: string; amount: number; date: string; delivery: SupplierDelivery }
    | { type: "wage"; id: string; amount: number; date: string; shift: ShiftWithDetails };

  const getHistoryItemDate = (item: HistoryItem) =>
    item.type === "expense" ? item.expense.date : item.date;

  const includePurchases =
    selectedCategories.length === 0 ||
    selectedCategories.includes(FILTER_PURCHASE);
  const includeWages =
    selectedCategories.length === 0 ||
    selectedCategories.includes(FILTER_WAGES);

  const combinedHistory: HistoryItem[] = [
    ...filteredExpenses.map((e) => ({ type: "expense" as const, expense: e })),
    ...(includePurchases
      ? filteredPurchaseExpenses.map((p) => ({
          type: "purchase" as const,
          id: p.id,
          amount: p.amount,
          date: p.date,
          delivery: p.delivery,
        }))
      : []),
    ...(includeWages
      ? filteredWageExpenses.map((w) => ({
          type: "wage" as const,
          id: w.id,
          amount: w.amount,
          date: w.date,
          shift: w.shift,
        }))
      : []),
  ].sort(
    (a, b) =>
      new Date(getHistoryItemDate(b)).getTime() -
      new Date(getHistoryItemDate(a)).getTime()
  );

  const totalPages = Math.ceil(combinedHistory.length / itemsPerPage);
  const paginatedHistory = combinedHistory.slice(
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

  // Скидання пагінації при зміні періоду
  useEffect(() => {
    setCurrentPage(1);
  }, [period]);

  const totalExpensesAmount = filteredExpenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );
  const totalPurchaseAmount = filteredPurchaseExpenses.reduce(
    (sum, p) => sum + p.amount,
    0
  );
  const totalWagesAmount = filteredWageExpenses.reduce(
    (sum, w) => sum + w.amount,
    0
  );
  const totalExpenses = combinedHistory.reduce(
    (sum, item) =>
      sum + (item.type === "expense" ? item.expense.amount : item.amount),
    0
  );

  const expensesByCategory = categories.map((category) => {
    const categoryExpenses = filteredExpenses.filter(
      (e) => e.category_id === category.id
    );
    const total = categoryExpenses.reduce(
      (sum, expense) => sum + expense.amount,
      0
    );
    return {
      ...category,
      total,
      count: categoryExpenses.length,
    };
  });

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error("Помилка", {
        description: "Назва категорії не може бути порожньою",
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
      toast.success("Успіх", {
        description: "Категорію додано",
      });
    } catch (error) {
      console.error("Помилка при додаванні категорії:", error);
      toast.error("Помилка", {
        description: "Не вдалося додати категорію",
      });
    }
  };

  const handleAddExpense = async () => {
    console.log("Starting to add expense:", {
      selectedCategory,
      newExpenseAmount,
      newExpenseDescription,
    });

    if (!selectedCategory || !newExpenseAmount) {
      console.log("Validation failed: missing category or amount");
      toast.error("Помилка", {
        description: "Необхідно вказати категорію та суму",
      });
      return;
    }

    const amount = parseFloat(newExpenseAmount);
    if (isNaN(amount) || amount <= 0) {
      console.log("Validation failed: invalid amount");
      toast.error("Помилка", {
        description: "Сума має бути більше нуля",
      });
      return;
    }

    try {
      console.log("Creating expense with data:", {
        category_id: parseInt(selectedCategory),
        amount,
        description: newExpenseDescription || "",
      });

      const dateStr =
        newExpenseDate instanceof Date
          ? new Date(
              newExpenseDate.getFullYear(),
              newExpenseDate.getMonth(),
              newExpenseDate.getDate(),
              12,
              0,
              0
            ).toISOString()
          : undefined;

      const newExpense = await createExpense(
        parseInt(selectedCategory),
        amount,
        newExpenseDescription || "",
        dateStr
      );

      console.log("Expense created successfully:", newExpense);

      setExpenses([...expenses, newExpense]);
      setNewExpenseAmount("");
      setNewExpenseDescription("");
      setNewExpenseDate(new Date());
      setSelectedCategory("");
      setIsAddExpenseDialogOpen(false);
      toast.success("Успіх", {
        description: "Витрату додано",
      });
    } catch (error) {
      console.error("Помилка при додаванні витрати:", error);
      toast.error("Помилка", {
        description: "Не вдалося додати витрату",
      });
    }
  };

  const handleDeleteCategory = async (
    categoryId: number,
    categoryName: string
  ) => {
    setDeleteCategoryDialog({
      isOpen: true,
      categoryId,
      categoryName,
    });
  };

  const confirmDeleteCategory = async () => {
    if (!deleteCategoryDialog.categoryId) return;

    try {
      await deleteExpenseCategory(deleteCategoryDialog.categoryId);
      setCategories(
        categories.filter((c) => c.id !== deleteCategoryDialog.categoryId)
      );
      setExpenses(
        expenses.filter(
          (e) => e.category_id !== deleteCategoryDialog.categoryId
        )
      );
      setDeleteCategoryDialog({
        isOpen: false,
        categoryId: null,
        categoryName: "",
      });
      toast.success("Успіх", {
        description: "Категорію видалено",
      });
    } catch (error) {
      console.error("Помилка при видаленні категорії:", error);
      toast.error("Помилка", {
        description: "Не вдалося видалити категорію",
      });
    }
  };

  const handleDeleteExpense = async (expenseId: number, amount: number) => {
    setDeleteExpenseDialog({
      isOpen: true,
      expenseId,
      expenseAmount: amount,
    });
  };

  const confirmDeleteExpense = async () => {
    if (!deleteExpenseDialog.expenseId) return;

    try {
      await deleteExpense(deleteExpenseDialog.expenseId);
      setExpenses(
        expenses.filter((e) => e.id !== deleteExpenseDialog.expenseId)
      );
      setDeleteExpenseDialog({
        isOpen: false,
        expenseId: null,
        expenseAmount: 0,
      });
      toast.success("Успіх", {
        description: "Витрату видалено",
      });
    } catch (error) {
      console.error("Помилка при видаленні витрати:", error);
      toast.error("Помилка", {
        description: "Не вдалося видалити витрату",
      });
    }
  };

  const handleEditExpense = (expense: Expense) => {
    setEditExpenseDialog({
      isOpen: true,
      expense,
    });
    setEditExpenseAmount(expense.amount.toString());
    setEditExpenseDescription(expense.description || "");
    setEditSelectedCategory(expense.category_id.toString());
  };

  const handleSaveExpense = async () => {
    if (!editExpenseDialog.expense) return;

    if (!editSelectedCategory || !editExpenseAmount) {
      toast.error("Помилка", {
        description: "Необхідно вказати категорію та суму",
      });
      return;
    }

    const amount = parseFloat(editExpenseAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Помилка", {
        description: "Сума має бути більше нуля",
      });
      return;
    }

    try {
      const updatedExpense = await updateExpense(
        editExpenseDialog.expense.id,
        parseInt(editSelectedCategory),
        amount,
        editExpenseDescription || ""
      );
      setExpenses(
        expenses.map((e) => (e.id === updatedExpense.id ? updatedExpense : e))
      );
      setEditExpenseDialog({ isOpen: false, expense: null });
      toast.success("Успіх", {
        description: "Витрату оновлено",
      });
    } catch (error) {
      console.error("Помилка при оновленні витрати:", error);
      toast.error("Помилка", {
        description: "Не вдалося оновити витрату",
      });
    }
  };

  const handleEditCategory = (category: ExpenseCategory) => {
    setEditCategoryDialog({
      isOpen: true,
      category,
    });
    setEditCategoryName(category.name);
    setEditCategoryDescription(category.description || "");
  };

  const handleSaveCategory = async () => {
    if (!editCategoryDialog.category) return;

    if (!editCategoryName.trim()) {
      toast.error("Помилка", {
        description: "Назва категорії не може бути порожньою",
      });
      return;
    }

    try {
      const updatedCategory = await updateExpenseCategory(
        editCategoryDialog.category.id,
        editCategoryName,
        editCategoryDescription || null
      );
      setCategories(
        categories.map((c) =>
          c.id === updatedCategory.id ? updatedCategory : c
        )
      );
      setEditCategoryDialog({ isOpen: false, category: null });
      toast.success("Успіх", {
        description: "Категорію оновлено",
      });
    } catch (error) {
      console.error("Помилка при оновленні категорії:", error);
      toast.error("Помилка", {
        description: "Не вдалося оновити категорію",
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
      {/* Модальні вікна підтвердження */}
      <DeleteConfirmationDialog
        isOpen={deleteCategoryDialog.isOpen}
        onClose={() =>
          setDeleteCategoryDialog({
            isOpen: false,
            categoryId: null,
            categoryName: "",
          })
        }
        onConfirm={confirmDeleteCategory}
        title="Видалити категорію"
        description={`Ви впевнені, що хочете видалити категорію "${deleteCategoryDialog.categoryName}"? Всі витрати в цій категорії також будуть видалені.`}
      />

      <DeleteConfirmationDialog
        isOpen={deleteExpenseDialog.isOpen}
        onClose={() =>
          setDeleteExpenseDialog({
            isOpen: false,
            expenseId: null,
            expenseAmount: 0,
          })
        }
        onConfirm={confirmDeleteExpense}
        title="Видалити витрату"
        description={`Ви впевнені, що хочете видалити витрату на суму ${formatNumberWithUnit(
          deleteExpenseDialog.expenseAmount,
          "₴"
        )}?`}
      />

      {/* Модальне вікно редагування категорії */}
      <Dialog
        open={editCategoryDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditCategoryDialog({ isOpen: false, category: null });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редагувати категорію</DialogTitle>
            <DialogDescription>Змініть дані категорії витрат</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editCategoryName">Назва категорії</Label>
              <Input
                id="editCategoryName"
                value={editCategoryName}
                onChange={(e) => setEditCategoryName(e.target.value)}
                placeholder="Наприклад: Матеріали"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editCategoryDescription">Опис</Label>
              <Input
                id="editCategoryDescription"
                value={editCategoryDescription}
                onChange={(e) => setEditCategoryDescription(e.target.value)}
                placeholder="Опис категорії (необов'язково)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setEditCategoryDialog({ isOpen: false, category: null })
              }
            >
              Скасувати
            </Button>
            <Button onClick={handleSaveCategory}>Зберегти</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Модальне вікно редагування витрати */}
      <Dialog
        open={editExpenseDialog.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditExpenseDialog({ isOpen: false, expense: null });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редагувати витрату</DialogTitle>
            <DialogDescription>Змініть дані витрати</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editCategory">Категорія</Label>
              <Select
                value={editSelectedCategory}
                onValueChange={setEditSelectedCategory}
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
              <Label htmlFor="editAmount">Сума</Label>
              <Input
                id="editAmount"
                type="number"
                value={editExpenseAmount}
                onChange={(e) => setEditExpenseAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editExpenseDescription">Опис</Label>
              <Input
                id="editExpenseDescription"
                value={editExpenseDescription}
                onChange={(e) => setEditExpenseDescription(e.target.value)}
                placeholder="Опис витрати (необов'язково)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setEditExpenseDialog({ isOpen: false, expense: null })
              }
            >
              Скасувати
            </Button>
            <Button onClick={handleSaveExpense}>Зберегти</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center justify-between mb-8">
        <div>
          <Link
            href="/"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад
          </Link>
          <h1 className="text-3xl font-bold">Облік витрат</h1>
          <p className="text-muted-foreground mb-2">
            Управління витратами на виробництві
          </p>
        </div>

        <div className="flex flex-wrap flex-col w-full sm:flex-row sm:w-auto gap-2">
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

          <Dialog
            open={isAddExpenseDialogOpen}
            onOpenChange={(open) => {
              setIsAddExpenseDialogOpen(open);
              if (open) setNewExpenseDate(new Date());
            }}
          >
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
                  <Label>Дата</Label>
                  <Popover
                    open={newExpenseDatePickerOpen}
                    onOpenChange={setNewExpenseDatePickerOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !newExpenseDate && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {newExpenseDate ? (
                          formatDate(
                            new Date(
                              newExpenseDate.getFullYear(),
                              newExpenseDate.getMonth(),
                              newExpenseDate.getDate()
                            ).toISOString()
                          )
                        ) : (
                          <span>Оберіть дату</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={newExpenseDate}
                        onSelect={(d) => {
                          setNewExpenseDate(d);
                          setNewExpenseDatePickerOpen(false);
                        }}
                        locale={uk}
                        weekStartsOn={1}
                      />
                    </PopoverContent>
                  </Popover>
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
                    placeholder="Опис витрати (необов'язково)"
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

      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={period === "day" ? "default" : "outline"}
            onClick={() => {
              setPeriod("day");
              setDateRange({ from: undefined, to: undefined });
            }}
          >
            День
          </Button>
          <Button
            variant={period === "week" ? "default" : "outline"}
            onClick={() => {
              setPeriod("week");
              setDateRange({ from: undefined, to: undefined });
            }}
          >
            Тиждень
          </Button>
          <Button
            variant={period === "month" ? "default" : "outline"}
            onClick={() => {
              setPeriod("month");
              setDateRange({ from: undefined, to: undefined });
            }}
          >
            Місяць
          </Button>
          <Button
            variant={period === "year" ? "default" : "outline"}
            onClick={() => {
              setPeriod("year");
              setDateRange({ from: undefined, to: undefined });
            }}
          >
            Рік
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={dateRange.from ? "default" : "outline"}
                className={cn(
                  "justify-start text-left font-normal",
                  !dateRange.from && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {dateRange.from ? (
                  dateRange.to ? (
                    <>
                      {formatDate(dateRange.from.toISOString())} -{" "}
                      {formatDate(dateRange.to.toISOString())}
                    </>
                  ) : (
                    formatDate(dateRange.from.toISOString())
                  )
                ) : (
                  <span className="text-black">Виберіть період</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                initialFocus
                mode="range"
                defaultMonth={dateRange.from}
                selected={dateRange}
                onSelect={(range) => {
                  if (range) {
                    setDateRange({
                      from: range.from,
                      to: range.to || range.from,
                    });
                    if (range.from) {
                      setPeriod("custom");
                    }
                  } else {
                    setDateRange({ from: undefined, to: undefined });
                  }
                }}
                numberOfMonths={2}
                locale={uk}
                weekStartsOn={1}
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={selectedCategories.length > 0 ? "default" : "outline"}
                className="justify-start text-left font-normal"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2 h-4 w-4"
                >
                  <path d="M3 6h18" />
                  <path d="M7 12h10" />
                  <path d="M10 18h4" />
                </svg>
                {selectedCategories.length > 0
                  ? `Категорії (${selectedCategories.length})`
                  : "Всі категорії"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-4" align="start">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Категорії</h4>
                  {selectedCategories.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCategories([])}
                    >
                      Скинути
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="category-purchase"
                      checked={selectedCategories.includes(FILTER_PURCHASE)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCategories([
                            ...selectedCategories,
                            FILTER_PURCHASE,
                          ]);
                        } else {
                          setSelectedCategories(
                            selectedCategories.filter(
                              (id) => id !== FILTER_PURCHASE
                            )
                          );
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <label
                      htmlFor="category-purchase"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Закупівля сировини
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="category-wages"
                      checked={selectedCategories.includes(FILTER_WAGES)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCategories([
                            ...selectedCategories,
                            FILTER_WAGES,
                          ]);
                        } else {
                          setSelectedCategories(
                            selectedCategories.filter(
                              (id) => id !== FILTER_WAGES
                            )
                          );
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <label
                      htmlFor="category-wages"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      З/П Лінія
                    </label>
                  </div>
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center space-x-2"
                    >
                      <input
                        type="checkbox"
                        id={`category-${category.id}`}
                        checked={selectedCategories.includes(category.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCategories([
                              ...selectedCategories,
                              category.id,
                            ]);
                          } else {
                            setSelectedCategories(
                              selectedCategories.filter(
                                (id) => id !== category.id
                              )
                            );
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <label
                        htmlFor={`category-${category.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {category.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="text-2xl font-bold">
          {formatNumberWithUnit(totalExpenses, "₴")}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Закупівля сировини</CardTitle>
            <p className="text-sm text-muted-foreground">
              Витрати на сировину з постачальників
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {formatNumberWithUnit(totalPurchaseAmount, "₴")}
              </div>
              <p className="text-xs text-muted-foreground">
                {filteredPurchaseExpenses.length} поставок
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">З/П Лінія</CardTitle>
            <p className="text-sm text-muted-foreground">
              Заробітна плата з виробництва (за винагородою за продукцію)
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">
                {formatNumberWithUnit(totalWagesAmount, "₴")}
              </div>
              <p className="text-xs text-muted-foreground">
                {filteredWageExpenses.length} змін
              </p>
            </div>
          </CardContent>
        </Card>
        {expensesByCategory.map((category) => (
          <Card key={category.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{category.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditCategory(category)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      <path d="m15 5 4 4" />
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      handleDeleteCategory(category.id, category.name)
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
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
                  {formatNumberWithUnit(category.total, "₴")}
                </div>
                <p className="text-xs text-muted-foreground">
                  {category.count} витрат
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold">Історія витрат</h2>
        {combinedHistory.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <p className="text-muted-foreground">
                  Немає зареєстрованих витрат, закупівель сировини та з/п з виробництва
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {paginatedHistory.map((item) =>
              item.type === "expense" ? (
                <Card key={item.expense.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {item.expense.category?.name || "Без категорії"}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-bold">
                          {formatNumberWithUnit(item.expense.amount, "₴")}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditExpense(item.expense)}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                          >
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            <path d="m15 5 4 4" />
                          </svg>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleDeleteExpense(
                              item.expense.id,
                              item.expense.amount
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(item.expense.date)}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{item.expense.description}</p>
                  </CardContent>
                </Card>
              ) : item.type === "wage" ? (
                <Card key={item.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">З/П Лінія</CardTitle>
                      <div className="text-lg font-bold">
                        {formatNumberWithUnit(item.amount, "₴")}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(item.date)}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      <Link
                        href={`/shifts/${item.shift.id}`}
                        className="text-primary hover:underline"
                      >
                        Зміна {formatDate(item.shift.shift_date)}
                      </Link>
                      {item.shift.employees?.length > 0 && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {item.shift.employees.length} прац.
                        </span>
                      )}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card key={item.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        Закупівля сировини
                      </CardTitle>
                      <div className="text-lg font-bold">
                        {formatNumberWithUnit(item.amount, "₴")}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(item.date)}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      {item.delivery.supplier?.name ?? "Постачальник"} —{" "}
                      {item.delivery.product?.name ?? item.delivery.product_id}{" "}
                      {item.delivery.quantity && (
                        <span className="text-muted-foreground">
                          ({formatNumberWithUnit(Number(item.delivery.quantity), "шт")})
                        </span>
                      )}
                    </p>
                  </CardContent>
                </Card>
              )
            )}

            {/* Пагінація */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Показано {paginatedHistory.length} з{" "}
                  {combinedHistory.length} записів
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    )
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
