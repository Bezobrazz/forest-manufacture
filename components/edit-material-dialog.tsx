"use client";

import type React from "react";

import { useState, useEffect } from "react";
import type { Product, ProductCategory } from "@/lib/types";
import { updateMaterial } from "@/app/actions";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EditMaterialDialogProps {
  material: Product;
  categories: ProductCategory[];
  onMaterialUpdated?: () => void; // Callback для оновлення списку матеріалів
}

export function EditMaterialDialog({
  material,
  categories = [],
  onMaterialUpdated,
}: EditMaterialDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [formData, setFormData] = useState({
    id: material.id,
    name: material.name,
    description: material.description || "",
    category_id: material.category_id ? material.category_id.toString() : "none",
    cost: material.cost !== null ? material.cost.toString() : "",
  });

  // Оновлюємо стан форми при зміні матеріалу
  useEffect(() => {
    setFormData({
      id: material.id,
      name: material.name,
      description: material.description || "",
      category_id: material.category_id
        ? material.category_id.toString()
        : "none",
      cost: material.cost !== null ? material.cost.toString() : "",
    });
  }, [material]);

  // Обробник зміни полів форми
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Обробник зміни категорії
  const handleCategoryChange = (value: string) => {
    setFormData((prev) => ({ ...prev, category_id: value }));
  };

  // Функція для оновлення списку матеріалів
  const refreshMaterials = async () => {
    if (onMaterialUpdated) {
      onMaterialUpdated();
    }
  };

  // Функція для відправки форми
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);

    try {
      // Створюємо FormData для відправки
      const submitFormData = new FormData();
      submitFormData.append("id", formData.id.toString());
      submitFormData.append("name", formData.name);
      submitFormData.append("description", formData.description);

      // Обробка категорії
      if (formData.category_id === "none") {
        submitFormData.append("category_id", "");
      } else {
        submitFormData.append("category_id", formData.category_id);
      }

      // Обробка вартості
      submitFormData.append("cost", formData.cost);

      console.log("Відправляємо дані:", {
        id: formData.id,
        name: formData.name,
        description: formData.description,
        category_id:
          formData.category_id === "none" ? "" : formData.category_id,
        cost: formData.cost,
      });

      // Викликаємо серверну дію
      const result = await updateMaterial(submitFormData);

      if (result.success) {
        setOpen(false);
        toast.success("Матеріал оновлено", {
          description: "Інформацію про матеріал успішно оновлено",
        });

        // Оновлюємо список матеріалів без перезавантаження сторінки
        if (onMaterialUpdated) {
          try {
            await onMaterialUpdated();
          } catch (refreshError) {
            console.error(
              "Помилка при оновленні списку матеріалів:",
              refreshError
            );
            // Не показуємо помилку користувачу, оскільки основна операція успішна
          }
        }
      } else {
        toast.error("Помилка", {
          description: result.error || "Не вдалося оновити матеріал",
        });
      }
    } catch (error) {
      console.error("Помилка при оновленні матеріалу:", error);
      toast.error("Помилка", {
        description: "Сталася помилка при оновленні матеріалу",
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Редагувати</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Редагування матеріалу</DialogTitle>
          <DialogDescription>
            Змініть інформацію про матеріал та натисніть "Зберегти зміни"
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor={`name-${material.id}`}>Назва матеріалу</Label>
            <Input
              id={`name-${material.id}`}
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`category-${material.id}`}>Категорія</Label>
            <Select
              value={formData.category_id}
              onValueChange={handleCategoryChange}
            >
              <SelectTrigger id={`category-${material.id}`}>
                <SelectValue placeholder="Виберіть категорію" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без категорії</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`description-${material.id}`}>Опис</Label>
            <Textarea
              id={`description-${material.id}`}
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`cost-${material.id}`}>Вартість</Label>
            <Input
              id={`cost-${material.id}`}
              name="cost"
              type="number"
              step="0.01"
              min="0"
              value={formData.cost}
              onChange={handleChange}
              placeholder="Введіть вартість матеріалу (необов'язково)"
            />
            <p className="text-xs text-muted-foreground">
              Вартість одиниці матеріалу
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Скасувати
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Збереження..." : "Зберегти зміни"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

