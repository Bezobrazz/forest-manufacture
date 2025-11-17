"use client";

import type React from "react";

import { useState } from "react";
import { createMaterial } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductCategory } from "@/lib/types";

interface MaterialFormProps {
  categories: ProductCategory[];
  onMaterialAdded?: () => Promise<void>;
}

export function MaterialForm({
  categories = [],
  onMaterialAdded,
}: MaterialFormProps) {
  const [isPending, setIsPending] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category_id: "none",
    cost: "",
  });

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

  // Функція для відправки форми
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);

    try {
      // Перевіряємо, що вартість є числом, якщо вона вказана
      if (formData.cost && isNaN(Number(formData.cost))) {
        toast.error("Помилка", {
          description: "Вартість повинна бути числом",
        });
        setIsPending(false);
        return;
      }

      // Створюємо FormData для відправки
      const submitFormData = new FormData();
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

      console.log("Відправляємо дані нового матеріалу:", {
        name: formData.name,
        description: formData.description,
        category_id:
          formData.category_id === "none" ? "" : formData.category_id,
        cost: formData.cost,
      });

      // Викликаємо серверну дію
      const result = await createMaterial(submitFormData);

      if (result.success) {
        toast.success("Матеріал додано", {
          description: "Новий матеріал успішно додано до системи",
        });

        // Очищаємо форму
        setFormData({
          name: "",
          description: "",
          category_id: "none",
          cost: "",
        });

        // Оновлюємо список матеріалів без перезавантаження сторінки
        if (onMaterialAdded) {
          try {
            await onMaterialAdded();
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
          description: result.error || "Не вдалося додати матеріал",
        });
      }
    } catch (error) {
      console.error("Помилка при додаванні матеріалу:", error);
      toast.error("Помилка", {
        description: "Сталася помилка при додаванні матеріалу",
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Назва матеріалу</Label>
        <Input
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="category_id">Категорія</Label>
        <Select
          value={formData.category_id}
          onValueChange={handleCategoryChange}
        >
          <SelectTrigger id="category_id">
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
        <Label htmlFor="cost">Вартість</Label>
        <Input
          id="cost"
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
      <div className="space-y-2">
        <Label htmlFor="description">Опис</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          value={formData.description}
          onChange={handleChange}
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Додавання..." : "Додати матеріал"}
      </Button>
    </form>
  );
}

