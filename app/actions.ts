import { createServerClient } from "@/lib/supabase";
import type {
  Employee,
  Product,
  ProductCategory,
  Shift,
  ShiftWithDetails,
  Inventory,
  InventoryTransaction,
  Task,
} from "@/lib/types";

// Отримання інформації про склад
export async function getInventory(): Promise<Inventory[]> {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("inventory")
      .select("*, product:products(*, category:product_categories(*))")
      .order("id");

    if (error) {
      console.error("Error fetching inventory:", error);
      return [];
    }

    return data as Inventory[];
  } catch (error) {
    console.error("Error in getInventory:", error);
    return [];
  }
}

// Отримання історії транзакцій складу
export async function getInventoryTransactions(): Promise<
  InventoryTransaction[]
> {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("inventory_transactions")
      .select("*, product:products(*, category:product_categories(*))")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching inventory transactions:", error);
      return [];
    }

    return data as InventoryTransaction[];
  } catch (error) {
    console.error("Error in getInventoryTransactions:", error);
    return [];
  }
}

// Оновлення кількості продукту на складі
export async function updateInventoryQuantity(
  productId: number,
  quantity: number,
  notes = ""
) {
  try {
    const supabase = createServerClient();

    try {
      // Отримуємо поточну кількість на складі
      const { data: currentInventory, error: getError } = await supabase
        .from("inventory")
        .select("quantity")
        .eq("product_id", productId)
        .single();

      if (getError && getError.code !== "PGRST116") {
        console.error("Error fetching current inventory:", getError);
        return { success: false, error: getError.message };
      }

      const currentQuantity = currentInventory?.quantity || 0;
      const adjustment = quantity - currentQuantity;

      // Якщо немає змін, повертаємо успіх
      if (adjustment === 0) {
        return { success: true };
      }

      // Починаємо транзакцію
      // 1. Оновлюємо кількість на складі
      const { error: updateError } = await supabase.from("inventory").upsert({
        product_id: productId,
        quantity: quantity,
        updated_at: new Date().toISOString(),
      });

      if (updateError) {
        console.error("Error updating inventory:", updateError);
        return { success: false, error: updateError.message };
      }

      // 2. Додаємо запис про транзакцію
      const { error: transactionError } = await supabase
        .from("inventory_transactions")
        .insert({
          product_id: productId,
          quantity: adjustment,
          transaction_type: "adjustment",
          notes: notes || "Ручне коригування кількості",
        });

      if (transactionError) {
        console.error(
          "Error creating inventory transaction:",
          transactionError
        );
        return { success: false, error: transactionError.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Unexpected error in updateInventoryQuantity:", error);
      return {
        success: false,
        error:
          "Сталася непередбачена помилка при оновленні кількості на складі",
      };
    }
  } catch (error) {
    console.error("Error in updateInventoryQuantity:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при оновленні кількості на складі",
    };
  }
}

// Відвантаження продукції зі складу
export async function shipInventory(formData: FormData) {
  try {
    const supabase = createServerClient();

    const productId = Number.parseInt(formData.get("product_id") as string);
    const quantity = Number.parseFloat(formData.get("quantity") as string);
    const notes = formData.get("notes") as string;

    if (!productId || isNaN(quantity) || quantity <= 0) {
      return {
        success: false,
        error: "Необхідно вказати продукт та кількість більше нуля",
      };
    }

    try {
      // Отримуємо поточну кількість на складі
      const { data: currentInventory, error: getError } = await supabase
        .from("inventory")
        .select("quantity")
        .eq("product_id", productId)
        .single();

      if (getError) {
        console.error("Error fetching current inventory:", getError);
        return { success: false, error: getError.message };
      }

      const currentQuantity = currentInventory?.quantity || 0;

      // Перевіряємо, чи достатньо продукції на складі
      if (currentQuantity < quantity) {
        return {
          success: false,
          error: `Недостатньо продукції на складі. Доступно: ${currentQuantity}`,
        };
      }

      // Починаємо транзакцію
      // 1. Оновлюємо кількість на складі
      const { error: updateError } = await supabase
        .from("inventory")
        .update({
          quantity: currentQuantity - quantity,
          updated_at: new Date().toISOString(),
        })
        .eq("product_id", productId);

      if (updateError) {
        console.error("Error updating inventory:", updateError);
        return { success: false, error: updateError.message };
      }

      // 2. Додаємо запис про транзакцію
      const { error: transactionError } = await supabase
        .from("inventory_transactions")
        .insert({
          product_id: productId,
          quantity: -quantity, // Від'ємне значення, оскільки це відвантаження
          transaction_type: "shipment",
          notes: notes || "Відвантаження продукції",
        });

      if (transactionError) {
        console.error(
          "Error creating inventory transaction:",
          transactionError
        );
        return { success: false, error: transactionError.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Unexpected error in shipInventory:", error);
      return {
        success: false,
        error: "Сталася непередбачена помилка при відвантаженні продукції",
      };
    }
  } catch (error) {
    console.error("Error in shipInventory:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при відвантаженні продукції",
    };
  }
}

export async function updateProduction(formData: FormData) {
  try {
    const supabase = createServerClient();

    const shiftId = Number.parseInt(formData.get("shift_id") as string);
    const productId = Number.parseInt(formData.get("product_id") as string);
    const quantity = Number.parseFloat(formData.get("quantity") as string);

    if (!shiftId || !productId || isNaN(quantity)) {
      return {
        success: false,
        error: "Необхідно вказати зміну, продукт та кількість",
      };
    }

    try {
      // Перевіряємо, чи існує вже запис
      const { data: existingData, error: checkError } = await supabase
        .from("production")
        .select("*")
        .eq("shift_id", shiftId)
        .eq("product_id", productId)
        .maybeSingle();

      if (checkError) {
        console.error("Error checking existing production:", checkError);
        return { success: false, error: checkError.message };
      }

      let result;
      let oldQuantity = 0;

      if (existingData) {
        oldQuantity = existingData.quantity;
        // Оновлюємо існуючий запис
        result = await supabase
          .from("production")
          .update({
            quantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingData.id)
          .select();
      } else {
        // Створюємо новий запис
        result = await supabase
          .from("production")
          .insert([
            {
              shift_id: shiftId,
              product_id: productId,
              quantity,
            },
          ])
          .select();
      }

      if (result.error) {
        console.error("Error updating production:", result.error);
        return { success: false, error: result.error.message };
      }

      // Оновлюємо кількість на складі
      const quantityDifference = quantity - oldQuantity;

      if (quantityDifference !== 0) {
        // Отримуємо поточну кількість на складі
        const { data: currentInventory, error: getError } = await supabase
          .from("inventory")
          .select("quantity, id")
          .eq("product_id", productId)
          .maybeSingle();

        if (getError && getError.code !== "PGRST116") {
          console.error("Error fetching current inventory:", getError);
          // Продовжуємо виконання, навіть якщо не вдалося отримати поточну кількість
        }

        const currentQuantity = currentInventory?.quantity || 0;
        const newQuantity = currentQuantity + quantityDifference;

        // Оновлюємо кількість на складі
        let updateError;

        if (currentInventory) {
          // Якщо запис існує, оновлюємо його
          const updateResult = await supabase
            .from("inventory")
            .update({
              quantity: newQuantity,
              updated_at: new Date().toISOString(),
            })
            .eq("id", currentInventory.id);

          updateError = updateResult.error;
        } else {
          // Якщо запису немає, створюємо новий
          const insertResult = await supabase.from("inventory").insert({
            product_id: productId,
            quantity: newQuantity,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          updateError = insertResult.error;
        }

        if (updateError) {
          console.error("Error updating inventory:", updateError);
          // Продовжуємо виконання, навіть якщо не вдалося оновити склад
        }

        // Додаємо запис про транзакцію
        const { error: transactionError } = await supabase
          .from("inventory_transactions")
          .insert({
            product_id: productId,
            quantity: quantityDifference,
            transaction_type: "production",
            reference_id: shiftId,
            notes: `Виробництво на зміні #${shiftId}`,
          });

        if (transactionError) {
          console.error(
            "Error creating inventory transaction:",
            transactionError
          );
          // Продовжуємо виконання, навіть якщо не вдалося створити запис про транзакцію
        }
      }

      return { success: true, data: result.data };
    } catch (error) {
      console.error("Unexpected error in updateProduction:", error);
      return {
        success: false,
        error: "Сталася непередбачена помилка при оновленні виробництва",
      };
    }
  } catch (error) {
    console.error("Error in updateProduction:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при оновленні виробництва",
    };
  }
}

export async function getActiveShifts(): Promise<ShiftWithDetails[]> {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("shifts")
      .select(
        `
        *,
        employees:shift_employees(*, employee:employees(*)),
        production:production(*, product:products(*, category:product_categories(*)))
      `
      )
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching active shifts:", error);
      return [];
    }

    return data as ShiftWithDetails[];
  } catch (error) {
    console.error("Error in getActiveShifts:", error);
    return [];
  }
}

export async function getShifts(): Promise<ShiftWithDetails[]> {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("shifts")
      .select(
        `
        *,
        employees:shift_employees(*, employee:employees(*)),
        production:production(*, product:products(*, category:product_categories(*)))
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching shifts:", error);
      return [];
    }

    return data as ShiftWithDetails[];
  } catch (error) {
    console.error("Error in getShifts:", error);
    return [];
  }
}

export async function getEmployees(): Promise<Employee[]> {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching employees:", error);
      return [];
    }

    return data as Employee[];
  } catch (error) {
    console.error("Error in getEmployees:", error);
    return [];
  }
}

// Оновлюємо функцію getProducts для кращої обробки помилок
export async function getProducts(): Promise<Product[]> {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("products")
      .select("*, category:product_categories(*)")
      .order("name");

    if (error) {
      console.error("Error fetching products:", error);
      return [];
    }

    return data as Product[];
  } catch (error) {
    console.error("Error in getProducts:", error);
    throw error; // Пробрасываем ошибку для обработки на клиенте
  }
}

// Оновлюємо функцію getProductCategories для кращої обробки помилок
export async function getProductCategories(): Promise<ProductCategory[]> {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("product_categories")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching product categories:", error);
      return [];
    }

    return data as ProductCategory[];
  } catch (error) {
    console.error("Error in getProductCategories:", error);
    throw error; // Пробрасываем ошибку для обработки на клиенте
  }
}

export async function getProductionStats(
  period: "year" | "month" | "week" = "year"
): Promise<{
  totalProduction: number;
  productionByCategory: Record<string, number>;
}> {
  try {
    const supabase = createServerClient();

    // Визначаємо початкову дату в залежності від періоду
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1); // 1 січня поточного року
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1); // 1 число поточного місяця
        break;
      case "week":
        const day = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - day); // Неділя поточного тижня
        break;
      default:
        startDate = new Date(now.getFullYear(), 0, 1);
    }

    try {
      const { data: productionData, error: productionError } = await supabase
        .from("production")
        .select(
          "quantity, shift:shifts(created_at), product:products(category_id, product_categories(name))"
        )
        .gte("shift.created_at", startDate.toISOString());

      if (productionError) {
        console.error("Error fetching production data:", productionError);
        return { totalProduction: 0, productionByCategory: {} };
      }

      let totalProduction = 0;
      const productionByCategory: Record<string, number> = {};

      productionData.forEach(
        (item: {
          quantity: number;
          product?: { category_id: number | null };
        }) => {
          totalProduction += item.quantity;

          const categoryName = item.product?.category_id
            ? (item.product as any)?.product_categories?.name || "Без категорії"
            : "Без категорії";

          productionByCategory[categoryName] =
            (productionByCategory[categoryName] || 0) + item.quantity;
        }
      );

      return { totalProduction, productionByCategory };
    } catch (error) {
      console.error("Error generating production stats:", error);
      return { totalProduction: 0, productionByCategory: {} };
    }
  } catch (error) {
    console.error("Error in getProductionStats:", error);
    return { totalProduction: 0, productionByCategory: {} };
  }
}

export async function addEmployeeToShift(formData: FormData) {
  try {
    const supabase = createServerClient();

    const shiftId = Number(formData.get("shift_id"));
    const employeeId = formData.get("employee_id");

    if (!shiftId || !employeeId) {
      return { success: false, error: "Необхідно вказати зміну та працівника" };
    }

    try {
      const { data, error } = await supabase
        .from("shift_employees")
        .insert([{ shift_id: shiftId, employee_id: employeeId }])
        .select();

      if (error) {
        console.error("Error adding employee to shift:", error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data };
    } catch (error) {
      console.error("Unexpected error in addEmployeeToShift:", error);
      return {
        success: false,
        error: "Сталася непередбачена помилка при додаванні працівника",
      };
    }
  } catch (error) {
    console.error("Error in addEmployeeToShift:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при додаванні працівника",
    };
  }
}

// Знайдіть функцію createProductCategory і замініть її на цю версію:

export async function createProductCategory(formData: FormData) {
  try {
    const supabase = createServerClient();

    const name = formData.get("name");

    if (!name) {
      return { success: false, error: "Необхідно вказати назву категорії" };
    }

    try {
      const { data, error } = await supabase
        .from("product_categories")
        .insert([{ name: name }])
        .select();

      if (error) {
        console.error("Error creating product category:", error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data };
    } catch (error) {
      console.error("Unexpected error in createProductCategory:", error);
      return {
        success: false,
        error: "Сталася непередбачена помилка при створенні категорії",
      };
    }
  } catch (error) {
    console.error("Error in createProductCategory:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при створенні категорії",
    };
  }
}

export async function completeShift(shiftId: number) {
  try {
    const supabase = createServerClient();

    if (!shiftId) {
      return { success: false, error: "Необхідно вказати ID зміни" };
    }

    try {
      // 1. Отримуємо всі дані про виробництво на цій зміні
      const { data: productionData, error: productionError } = await supabase
        .from("production")
        .select("product_id, quantity")
        .eq("shift_id", shiftId);

      if (productionError) {
        console.error("Error fetching production data:", productionError);
        return { success: false, error: productionError.message };
      }

      // 2. Оновлюємо склад для кожного виробленого продукту
      for (const item of productionData) {
        // 2.1 Отримуємо поточну кількість на складі
        const { data: inventoryData, error: inventoryError } = await supabase
          .from("inventory")
          .select("quantity, id")
          .eq("product_id", item.product_id)
          .maybeSingle();

        if (inventoryError && inventoryError.code !== "PGRST116") {
          console.error("Error fetching inventory data:", inventoryError);
          continue; // Продовжуємо з наступним продуктом
        }

        const currentQuantity = inventoryData?.quantity || 0;
        const newQuantity = currentQuantity + item.quantity;

        // 2.2 Оновлюємо кількість на складі
        let updateError;

        if (inventoryData) {
          // Якщо запис існує, оновлюємо його
          const updateResult = await supabase
            .from("inventory")
            .update({
              quantity: newQuantity,
              updated_at: new Date().toISOString(),
            })
            .eq("id", inventoryData.id);

          updateError = updateResult.error;
        } else {
          // Якщо запису немає, створюємо новий
          const insertResult = await supabase.from("inventory").insert({
            product_id: item.product_id,
            quantity: item.quantity,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          updateError = insertResult.error;
        }

        if (updateError) {
          console.error("Error updating inventory:", updateError);
          continue; // Продовжуємо з наступним продуктом
        }

        // 2.3 Додаємо запис про транзакцію
        const { error: transactionError } = await supabase
          .from("inventory_transactions")
          .insert({
            product_id: item.product_id,
            quantity: item.quantity,
            transaction_type: "production",
            reference_id: shiftId,
            notes: `Виробництво на зміні #${shiftId} (автоматичне додавання при закритті зміни)`,
          });

        if (transactionError) {
          console.error(
            "Error creating inventory transaction:",
            transactionError
          );
          // Продовжуємо, навіть якщо не вдалося створити запис про транзакцію
        }
      }

      // 3. Змінюємо статус зміни на "completed"
      const { data, error } = await supabase
        .from("shifts")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", shiftId)
        .select();

      if (error) {
        console.error("Error completing shift:", error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data };
    } catch (error) {
      console.error("Unexpected error in completeShift:", error);
      return {
        success: false,
        error: "Сталася непередбачена помилка при завершенні зміни",
      };
    }
  } catch (error) {
    console.error("Error in completeShift:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при завершенні зміни",
    };
  }
}

export async function createShift(formData: FormData) {
  try {
    const supabase = createServerClient();

    const shift_date = formData.get("shift_date");
    const notes = formData.get("notes");

    if (!shift_date) {
      return { success: false, error: "Необхідно вказати дату зміни" };
    }

    try {
      const { data, error } = await supabase
        .from("shifts")
        .insert([{ shift_date: shift_date, notes: notes }])
        .select();

      if (error) {
        console.error("Error creating shift:", error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data };
    } catch (error) {
      console.error("Unexpected error in createShift:", error);
      return {
        success: false,
        error: "Сталася непередбачена помилка при створенні зміни",
      };
    }
  } catch (error) {
    console.error("Error in createShift:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при створенні зміни",
    };
  }
}

export async function createShiftWithEmployees(
  formData: FormData,
  employeeIds: number[]
) {
  try {
    const supabase = createServerClient();

    const shift_date = formData.get("shift_date");
    const notes = formData.get("notes");

    if (!shift_date) {
      return { success: false, error: "Необхідно вказати дату зміни" };
    }

    if (employeeIds.length === 0) {
      return {
        success: false,
        error: "Необхідно вибрати хоча б одного працівника",
      };
    }

    try {
      // Створюємо зміну
      const { data: shiftData, error: shiftError } = await supabase
        .from("shifts")
        .insert([{ shift_date: shift_date, notes: notes }])
        .select();

      if (shiftError) {
        console.error("Error creating shift:", shiftError);
        return { success: false, error: shiftError.message };
      }

      // Отримуємо ID створеної зміни
      const shiftId = shiftData[0].id;

      // Додаємо працівників до зміни
      const shiftEmployees = employeeIds.map((employeeId) => ({
        shift_id: shiftId,
        employee_id: employeeId,
      }));

      const { data: shiftEmployeesData, error: shiftEmployeesError } =
        await supabase.from("shift_employees").insert(shiftEmployees).select();

      if (shiftEmployeesError) {
        console.error("Error adding employees to shift:", shiftEmployeesError);
        return { success: false, error: shiftEmployeesError.message };
      }

      return { success: true, data: shiftData };
    } catch (error) {
      console.error("Unexpected error in createShiftWithEmployees:", error);
      return {
        success: false,
        error: "Сталася непередбачена помилка при створенні зміни",
      };
    }
  } catch (error) {
    console.error("Error in createShiftWithEmployees:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при створенні зміни",
    };
  }
}

// Знайдіть функцію deleteProductCategory і замініть її на цю версію:

export async function deleteProductCategory(categoryId: number) {
  try {
    const supabase = createServerClient();

    if (!categoryId) {
      return { success: false, error: "Необхідно вказати ID категорії" };
    }

    try {
      // Спочатку перевіряємо, скільки продуктів використовують цю категорію
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("*")
        .eq("category_id", categoryId);

      if (productsError) {
        console.error("Error fetching products in category:", productsError);
        return { success: false, error: productsError.message };
      }

      // Якщо є продукти в цій категорії, оновлюємо їх, встановлюючи category_id в NULL
      let updatedProducts = 0;
      if (products && products.length > 0) {
        const { error: updateError } = await supabase
          .from("products")
          .update({ category_id: null })
          .eq("category_id", categoryId);

        if (updateError) {
          console.error("Error updating products in category:", updateError);
          return { success: false, error: updateError.message };
        }
        updatedProducts = products.length;
      }

      // Потім видаляємо категорію
      const { error: deleteError } = await supabase
        .from("product_categories")
        .delete()
        .eq("id", categoryId);

      if (deleteError) {
        console.error("Error deleting product category:", deleteError);
        return { success: false, error: deleteError.message };
      }

      return { success: true, updatedProducts: updatedProducts };
    } catch (error) {
      console.error("Unexpected error in deleteProductCategory:", error);
      return {
        success: false,
        error: "Сталася непередбачена помилка при видаленні категорії",
      };
    }
  } catch (error) {
    console.error("Error in deleteProductCategory:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при видаленні категорії",
    };
  }
}

// Знайдіть функцію deleteProduct і замініть її на цю версію:

export async function deleteProduct(productId: number) {
  try {
    const supabase = createServerClient();

    if (!productId) {
      return { success: false, error: "Необхідно вказати ID продукту" };
    }

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId);

      if (error) {
        console.error("Error deleting product:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Unexpected error in deleteProduct:", error);
      return {
        success: false,
        error: "Сталася непередбачена помилка при видаленні продукту",
      };
    }
  } catch (error) {
    console.error("Error in deleteProduct:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при видаленні продукту",
    };
  }
}

export async function deleteShift(shiftId: number) {
  try {
    const supabase = createServerClient();

    if (!shiftId) {
      return { success: false, error: "Необхідно вказати ID зміни" };
    }

    try {
      const { error } = await supabase
        .from("shifts")
        .delete()
        .eq("id", shiftId);

      if (error) {
        console.error("Error deleting shift:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Unexpected error in deleteShift:", error);
      return {
        success: false,
        error: "Сталася непередбачена помилка при видаленні зміни",
      };
    }
  } catch (error) {
    console.error("Error in deleteShift:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при видаленні зміни",
    };
  }
}

// Знайдіть функцію updateProduct і замініть її на цю версію:

export async function updateProduct(formData: FormData) {
  try {
    const supabase = createServerClient();

    const id = Number(formData.get("id"));
    const name = formData.get("name");
    const description = formData.get("description");
    const category_id =
      formData.get("category_id") === ""
        ? null
        : Number(formData.get("category_id"));
    const reward =
      formData.get("reward") === "" ? null : Number(formData.get("reward"));

    // Логуємо отримані дані
    console.log("updateProduct отримав такі дані:");
    console.log("ID:", id);
    console.log("Назва:", name);
    console.log("Опис:", description);
    console.log("Категорія ID:", category_id);
    console.log("Винагорода:", reward, "Тип:", typeof reward);

    if (!id || !name) {
      return {
        success: false,
        error: "Необхідно вказати ID та назву продукту",
      };
    }

    try {
      // Створюємо об'єкт для оновлення
      const updateData = {
        name: name,
        description: description,
        category_id: category_id,
        reward: reward,
      };

      console.log("Дані для оновлення:", updateData);

      const { data, error } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", id)
        .select();

      if (error) {
        console.error("Error updating product:", error);
        return { success: false, error: error.message };
      }

      console.log("Результат оновлення:", data);

      // Клієнт сам оновить дані через onProductUpdated callback
      return { success: true, data: data };
    } catch (error) {
      console.error("Unexpected error in updateProduct:", error);
      return {
        success: false,
        error: "Сталася непередбачена помилка при оновленні продукту",
      };
    }
  } catch (error) {
    console.error("Error in updateProduct:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при оновленні продукту",
    };
  }
}

export async function createEmployee(formData: FormData) {
  try {
    const supabase = createServerClient();

    const name = formData.get("name");
    const position = formData.get("position");

    if (!name) {
      return { success: false, error: "Необхідно вказати ім'я працівника" };
    }

    try {
      const { data, error } = await supabase
        .from("employees")
        .insert([{ name: name, position: position }])
        .select();

      if (error) {
        console.error("Error creating employee:", error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data };
    } catch (error) {
      console.error("Unexpected error in createEmployee:", error);
      return {
        success: false,
        error: "Сталася непередбачена помилка при створенні працівника",
      };
    }
  } catch (error) {
    console.error("Error in createEmployee:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при створенні працівника",
    };
  }
}

// Знаходимо функцію createProduct і оновлюємо її для кращої обробки даних

export async function createProduct(formData: FormData) {
  try {
    const supabase = createServerClient();

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const category_id_raw = formData.get("category_id") as string;
    const reward_raw = formData.get("reward") as string;

    // Обробка значень
    const category_id = category_id_raw === "" ? null : Number(category_id_raw);
    const reward = reward_raw === "" ? null : Number(reward_raw);

    // Логування для відлагодження
    console.log("createProduct отримав такі дані:");
    console.log("Назва:", name);
    console.log("Опис:", description);
    console.log("Категорія ID:", category_id);
    console.log("Винагорода:", reward, "Тип:", typeof reward);

    if (!name) {
      return { success: false, error: "Необхідно вказати назву продукту" };
    }

    try {
      const { data, error } = await supabase
        .from("products")
        .insert([{ name, description, category_id, reward }])
        .select();

      if (error) {
        console.error("Error creating product:", error);
        return { success: false, error: error.message };
      }

      console.log("Продукт успішно створено:", data);
      return { success: true, data: data };
    } catch (error) {
      console.error("Unexpected error in createProduct:", error);
      return {
        success: false,
        error: "Сталася непередбачена помилка при створенні продукту",
      };
    }
  } catch (error) {
    console.error("Error in createProduct:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при створенні продукту",
    };
  }
}

export async function removeEmployeeFromShift(
  shiftId: number,
  employeeId: number
) {
  try {
    const supabase = createServerClient();

    if (!shiftId || !employeeId) {
      return {
        success: false,
        error: "Необхідно вказати ID зміни та працівника",
      };
    }

    try {
      const { error } = await supabase
        .from("shift_employees")
        .delete()
        .eq("shift_id", shiftId)
        .eq("employee_id", employeeId);

      if (error) {
        console.error("Error removing employee from shift:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Unexpected error in removeEmployeeFromShift:", error);
      return {
        success: false,
        error:
          "Сталася непередбачена помилка при видаленні працівника зі зміни",
      };
    }
  } catch (error) {
    console.error("Error in removeEmployeeFromShift:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при видаленні працівника зі зміни",
    };
  }
}

export async function getShiftDetails(
  shiftId: number
): Promise<ShiftWithDetails | null> {
  try {
    const supabase = createServerClient();

    if (!shiftId) {
      console.error("Shift ID is required");
      return null;
    }

    try {
      const { data: shift, error: shiftError } = await supabase
        .from("shifts")
        .select("*")
        .eq("id", shiftId)
        .single();

      if (shiftError) {
        console.error("Error fetching shift:", shiftError);
        return null;
      }

      const { data: employees, error: employeesError } = await supabase
        .from("shift_employees")
        .select("*, employee:employees(*)")
        .eq("shift_id", shiftId);

      if (employeesError) {
        console.error("Error fetching shift employees:", employeesError);
        return null;
      }

      const { data: production, error: productionError } = await supabase
        .from("production")
        .select("*, product:products(*, category:product_categories(*))")
        .eq("shift_id", shiftId);

      if (productionError) {
        console.error("Error fetching production:", productionError);
        return null;
      }

      return {
        ...shift,
        employees: employees as any,
        production: production as any,
      };
    } catch (error) {
      console.error("Unexpected error in getShiftDetails:", error);
      return null;
    }
  } catch (error) {
    console.error("Error in getShiftDetails:", error);
    return null;
  }
}

export async function manuallyUpdateInventoryFromProduction() {
  try {
    const supabase = createServerClient();

    // 1. Отримуємо всі дані про виробництво
    const { data: productionData, error: productionError } = await supabase
      .from("production")
      .select("product_id, quantity, shift_id");

    if (productionError) {
      console.error("Error fetching production data:", productionError);
      return { success: false, error: productionError.message };
    }

    console.log(`Found ${productionData.length} production items`);

    // 2. Групуємо дані за product_id для підрахунку загальної кількості
    const productTotals: Record<number, number> = {};

    for (const item of productionData) {
      if (!item.product_id) continue;

      const quantity = Number(item.quantity);
      if (isNaN(quantity)) continue;

      if (!productTotals[item.product_id]) {
        productTotals[item.product_id] = 0;
      }

      productTotals[item.product_id] += quantity;
    }

    console.log("Product totals:", productTotals);

    // 3. Оновлюємо інвентар для кожного продукту
    const results = [];

    for (const [productId, totalQuantity] of Object.entries(productTotals)) {
      const numericProductId = Number(productId);

      console.log(
        `Updating inventory for product ID ${numericProductId} to ${totalQuantity}`
      );

      // Спочатку перевіряємо, чи існує запис для цього продукту
      const { data: existingInventory, error: checkError } = await supabase
        .from("inventory")
        .select("id, quantity")
        .eq("product_id", numericProductId)
        .maybeSingle();

      if (checkError) {
        console.error(
          `Error checking inventory for product ID ${numericProductId}:`,
          checkError
        );
        results.push({
          productId: numericProductId,
          success: false,
          error: checkError.message,
        });
        continue;
      }

      let updateResult;

      if (existingInventory) {
        // Якщо запис існує, оновлюємо його
        console.log(
          `Existing inventory found for product ID ${numericProductId}, updating...`
        );
        updateResult = await supabase
          .from("inventory")
          .update({
            quantity: totalQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingInventory.id);
      } else {
        // Якщо запису немає, створюємо новий
        console.log(
          `No existing inventory for product ID ${numericProductId}, inserting...`
        );
        updateResult = await supabase.from("inventory").insert({
          product_id: numericProductId,
          quantity: totalQuantity,
          updated_at: new Date().toISOString(),
        });
      }

      if (updateResult.error) {
        console.error(
          `Error updating inventory for product ID ${numericProductId}:`,
          updateResult.error
        );
        results.push({
          productId: numericProductId,
          success: false,
          error: updateResult.error.message,
        });
      } else {
        results.push({
          productId: numericProductId,
          success: true,
          quantity: totalQuantity,
        });
      }
    }

    return { success: true, results };
  } catch (error) {
    console.error("Error in manuallyUpdateInventoryFromProduction:", error);
    return { success: false, error: "Сталася помилка при оновленні інвентарю" };
  }
}

export async function getTasks() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tasks:", error);
      return [];
    }

    return data;
  } catch (error) {
    console.error("Error in getTasks:", error);
    return [];
  }
}

export async function createTask(
  task: Omit<Task, "id" | "created_at" | "completed_at">
) {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("tasks")
      .insert([task])
      .select()
      .single();

    if (error) {
      console.error("Error creating task:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error in createTask:", error);
    return { success: false, error: "Сталася помилка при створенні задачі" };
  }
}

export async function updateTaskStatus(taskId: number, status: Task["status"]) {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("tasks")
      .update({
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", taskId)
      .select()
      .single();

    if (error) {
      console.error("Error updating task status:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error in updateTaskStatus:", error);
    return {
      success: false,
      error: "Сталася помилка при оновленні статусу задачі",
    };
  }
}

export async function deleteTask(taskId: number) {
  try {
    const supabase = createServerClient();
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (error) {
      console.error("Error deleting task:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in deleteTask:", error);
    return { success: false, error: "Сталася помилка при видаленні задачі" };
  }
}

export async function getActiveTasks() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Error fetching active tasks:", error);
      return [];
    }

    return data;
  } catch (error) {
    console.error("Error in getActiveTasks:", error);
    return [];
  }
}
