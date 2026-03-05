"use server";

import { createServerClient } from "@/lib/supabase/server";
import type {
  Employee,
  Product,
  ProductCategory,
  Shift,
  ShiftWithDetails,
  Inventory,
  InventoryTransaction,
  Task,
  Supplier,
  SupplierDelivery,
  SupplierAdvanceTransaction,
  Warehouse,
} from "@/lib/types";
import { sendTelegramMessage } from "@/lib/telegram";
import { getDateRangeForPeriod } from "@/lib/utils";
import { revalidatePath, revalidateTag } from "next/cache";

// Отримання інформації про склад
export async function getInventory(): Promise<Inventory[]> {
  try {
    const supabase = await createServerClient();

    const { data: oldInventoryData, error: oldInventoryError } = await supabase
      .from("inventory")
      .select("*, product:products(*, category:product_categories(*))")
      .order("id");

    const { data: mainWarehouseData } = await supabase
      .from("warehouses")
      .select("id")
      .ilike("name", "%main%")
      .limit(1)
      .single();

    let warehouseInventoryData: any[] = [];
    if (mainWarehouseData) {
      const { data, error } = await supabase
        .from("warehouse_inventory")
        .select(
          "id, product_id, quantity, updated_at, product:products(*, category:product_categories(*))"
        )
        .eq("warehouse_id", mainWarehouseData.id)
        .order("id");

      if (!error && data) {
        warehouseInventoryData = data;
      }
    }

    const result: Inventory[] = [];

    if (!oldInventoryError && oldInventoryData) {
      const finishedProducts = oldInventoryData.filter(
        (item) =>
          item.product?.product_type !== "material" &&
          (item.product?.product_type === "finished" ||
            (item.product?.product_type === null && item.product?.reward !== null))
      );
      result.push(...(finishedProducts as Inventory[]));
    }

    const warehouseInventory = warehouseInventoryData
      .filter((item) => item.product?.product_type === "material")
      .map((item) => ({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        updated_at: item.updated_at,
        product: item.product,
      })) as Inventory[];

    result.push(...warehouseInventory);

    return result;
  } catch (error) {
    console.error("Error in getInventory:", error);
    try {
      const supabase = await createServerClient();
      const { data, error } = await supabase
        .from("inventory")
        .select("*, product:products(*, category:product_categories(*))")
        .order("id");

      if (error) {
        console.error("Error fetching inventory:", error);
        return [];
      }

      return data as Inventory[];
    } catch (fallbackError) {
      console.error("Error in getInventory fallback:", fallbackError);
      return [];
    }
  }
}

// Отримання історії транзакцій складу
export async function getInventoryTransactions(): Promise<
  InventoryTransaction[]
> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("inventory_transactions")
      .select("*, product:products(*, category:product_categories(*))")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching inventory transactions:", error);
      return [];
    }

    console.log(
      `Loaded ${data?.length || 0} inventory transactions from database`
    );
    if (data && data.length > 0) {
      console.log("Sample transactions:", data.slice(0, 3));
      const productionTransactions = data.filter(
        (t: any) => t.transaction_type === "production"
      );
      console.log(
        `Found ${productionTransactions.length} production transactions:`,
        productionTransactions.slice(0, 5)
      );
    }

    return (data || []).filter((t) => t != null) as InventoryTransaction[];
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
  console.log(
    `Початок оновлення інвентаря для продукту ${productId}, нова кількість: ${quantity}`
  );
  try {
    const supabase = await createServerClient();

    const { data: currentInventory, error: getError } = await supabase
      .from("inventory")
      .select("quantity, id")
      .eq("product_id", productId)
      .maybeSingle();

    if (getError) {
      console.error(
        `Помилка отримання даних інвентаря для продукту ${productId}:`,
        getError
      );
      return { success: false, error: getError.message };
    }

    console.log(`Поточні дані інвентаря:`, currentInventory);

    let adjustment = 0;
    if (currentInventory) {
      adjustment = quantity - currentInventory.quantity;
      console.log(
        `Зміна кількості: ${adjustment} (${currentInventory.quantity} -> ${quantity})`
      );
    } else {
      adjustment = quantity;
      console.log(`Новий продукт, початкова кількість: ${quantity}`);
    }

    // Якщо немає змін, повертаємо успіх
    if (adjustment === 0 && currentInventory) {
      console.log(`Кількість не змінилася, пропускаємо оновлення`);
      return { success: true };
    }

    console.log(`Використовуємо upsert для оновлення інвентаря`);
    const { error: updateError } = await supabase.from("inventory").upsert(
      {
        product_id: productId,
        quantity: quantity,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "product_id",
        ignoreDuplicates: false,
      }
    );

    if (updateError) {
      console.error(`Помилка оновлення інвентаря:`, updateError);
      return { success: false, error: updateError.message };
    }

    console.log(`Інвентар успішно оновлено, додаємо запис про транзакцію`);

    const { data: mainWarehouse, error: warehouseError } = await supabase
      .from("warehouses")
      .select("id")
      .ilike("name", "%main%")
      .limit(1)
      .single();

    if (warehouseError) {
      console.error("Error fetching main warehouse:", warehouseError);
    }

    const transactionData: any = {
      product_id: productId,
      quantity: adjustment,
      transaction_type: "adjustment",
      notes: notes || "Ручне коригування кількості",
    };

    if (mainWarehouse?.id) {
      transactionData.warehouse_id = mainWarehouse.id;
    }

    console.log(`Дані транзакції:`, transactionData);

    const { error: transactionError, data: transactionResult } = await supabase
      .from("inventory_transactions")
      .insert(transactionData)
      .select();

    if (transactionError) {
      console.error(
        `Помилка створення транзакції інвентаря:`,
        transactionError
      );
      return { success: false, error: transactionError.message };
    }

    console.log(`Транзакція успішно створена:`, transactionResult);
    return { success: true };
  } catch (error) {
    console.error(`Непередбачена помилка в updateInventoryQuantity:`, error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при оновленні кількості на складі",
    };
  }
}

// Відвантаження продукції зі складу
export async function shipInventory(formData: FormData) {
  try {
    const supabase = await createServerClient();

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

      const { data: mainWarehouse, error: warehouseError } = await supabase
        .from("warehouses")
        .select("id")
        .ilike("name", "%main%")
        .limit(1)
        .single();

      if (warehouseError) {
        console.error("Error fetching main warehouse:", warehouseError);
      }

      const transactionData: any = {
        product_id: productId,
        quantity: -quantity, // Від'ємне значення, оскільки це відвантаження
        transaction_type: "shipment",
        notes: notes || "Відвантаження продукції",
      };

      if (mainWarehouse?.id) {
        transactionData.warehouse_id = mainWarehouse.id;
      }

      const { error: transactionError, data: transactionResult } =
        await supabase
          .from("inventory_transactions")
          .insert(transactionData)
          .select();

      if (transactionError) {
        console.error(
          "Error creating inventory transaction:",
          transactionError
        );
        return { success: false, error: transactionError.message };
      }

      console.log("Successfully created shipment transaction:", transactionResult);

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
    const supabase = await createServerClient();

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

      if (existingData) {
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
    const supabase = await createServerClient();

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
    const supabase = await createServerClient();

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
    const supabase = await createServerClient();

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
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("products")
      .select("*, category:product_categories(*)")
      .or("product_type.eq.finished,product_type.is.null") // Фільтруємо тільки готову продукцію
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

export async function getProductsByCategoryName(
  categoryName: string
): Promise<Product[]> {
  try {
    const supabase = await createServerClient();
    const { data: categories } = await supabase
      .from("product_categories")
      .select("id")
      .eq("name", categoryName);
    const categoryIds = (categories ?? []).map((c) => c.id);
    if (categoryIds.length === 0) return [];
    const { data, error } = await supabase
      .from("products")
      .select("*, category:product_categories(*)")
      .in("category_id", categoryIds)
      .order("name");
    if (error) {
      console.error("Error fetching products by category:", error);
      return [];
    }
    return (data ?? []) as Product[];
  } catch (error) {
    console.error("Error in getProductsByCategoryName:", error);
    return [];
  }
}

// Оновлюємо функцію getProductCategories для кращої обробки помилок
export async function getProductCategories(): Promise<ProductCategory[]> {
  try {
    const supabase = await createServerClient();

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
  period: "year" | "month" | "week" = "year",
  year?: number
): Promise<{
  totalProduction: number;
  productionByCategory: Record<string, number>;
}> {
  try {
    const supabase = await createServerClient();

    const { startDate, endDate } = getDateRangeForPeriod(period, year);

    try {
      const startStr = startDate.toISOString().split("T")[0];
      const endStr = endDate.toISOString().split("T")[0];

      const { data: shiftsData, error: shiftsError } = await supabase
        .from("shifts")
        .select("id")
        .eq("status", "completed")
        .gte("shift_date", startStr)
        .lte("shift_date", endStr);

      if (shiftsError) {
        console.error("Error fetching shifts:", shiftsError);
        return { totalProduction: 0, productionByCategory: {} };
      }

      if (!shiftsData || shiftsData.length === 0) {
        return { totalProduction: 0, productionByCategory: {} };
      }

      const shiftIds = shiftsData.map((shift) => shift.id);

      // Отримуємо production для цих shifts
      const { data: productionData, error: productionError } = await supabase
        .from("production")
        .select(
          "quantity, product:products(category_id, category:product_categories(name))"
        )
        .in("shift_id", shiftIds);

      if (productionError) {
        console.error("Error fetching production data:", productionError);
        return { totalProduction: 0, productionByCategory: {} };
      }

      let totalProduction = 0;
      const productionByCategory: Record<string, number> = {};

      if (productionData) {
        productionData.forEach((item: any) => {
          const quantity = Math.round(item.quantity || 0);
          totalProduction += quantity;

          const categoryName = item.product?.category?.name || "Без категорії";

          productionByCategory[categoryName] =
            Math.round((productionByCategory[categoryName] || 0) + quantity);
        });
      }

      // Округлюємо до цілого числа, оскільки товари не можуть бути дробовими
      return { 
        totalProduction: Math.round(totalProduction), 
        productionByCategory: Object.fromEntries(
          Object.entries(productionByCategory).map(([key, value]) => [
            key,
            Math.round(value),
          ])
        ),
      };
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
    const supabase = await createServerClient();

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
    const supabase = await createServerClient();

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
    console.log("Starting completeShift function with shiftId:", shiftId);
    const supabase = await createServerClient();

    if (!shiftId) {
      console.error("No shiftId provided");
      return { success: false, error: "Необхідно вказати ID зміни" };
    }

    try {
      console.log("Fetching shift data from Supabase...");
      // 1. Отримуємо інформацію про зміну
      const { data: shiftData, error: shiftError } = await supabase
        .from("shifts")
        .select("*")
        .eq("id", shiftId)
        .single();

      console.log("Supabase response:", { shiftData, shiftError });

      if (shiftError) {
        console.error("Error fetching shift data:", shiftError);
        return { success: false, error: shiftError.message };
      }

      if (!shiftData) {
        console.error("No shift data found for ID:", shiftId);
        return { success: false, error: "Зміну не знайдено" };
      }

      // 1.1 Отримуємо інформацію про вироблену продукцію
      console.log("Fetching production data...");
      const { data: productionData, error: productionError } = await supabase
        .from("production")
        .select(
          `
          quantity,
          product:products (
            id,
            name,
            category:product_categories (
              name
            )
          )
        `
        )
        .eq("shift_id", shiftId);

      console.log("Production data:", { productionData, productionError });

      if (productionError) {
        console.error("Error fetching production data:", productionError);
        return { success: false, error: productionError.message };
      }

      // Об'єднуємо дані
      shiftData.production = productionData || [];

      // 1.2 Отримуємо ID Main warehouse для транзакцій
      const { data: mainWarehouse, error: warehouseError } = await supabase
        .from("warehouses")
        .select("id")
        .ilike("name", "%main%")
        .limit(1)
        .single();

      if (warehouseError) {
        console.error("Error fetching main warehouse:", warehouseError);
        // Продовжуємо без warehouse_id, але це може призвести до проблем
      }

      // 2. Оновлюємо інвентар та створюємо транзакції
      const transactionErrors: string[] = [];
      for (const item of shiftData.production || []) {
        // 2.1 Отримуємо поточну кількість на складі
        const { data: inventoryData, error: inventoryError } = await supabase
          .from("inventory")
          .select("quantity, id")
          .eq("product_id", item.product.id)
          .maybeSingle();

        if (inventoryError && inventoryError.code !== "PGRST116") {
          console.error("Error fetching inventory data:", inventoryError);
          transactionErrors.push(
            `Помилка отримання інвентаря для продукту ${item.product.name}: ${inventoryError.message}`
          );
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
            product_id: item.product.id,
            quantity: item.quantity,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          updateError = insertResult.error;
        }

        if (updateError) {
          console.error("Error updating inventory:", updateError);
          transactionErrors.push(
            `Помилка оновлення інвентаря для продукту ${item.product.name}: ${updateError.message}`
          );
          continue; // Продовжуємо з наступним продуктом
        }

        // 2.3 Додаємо запис про транзакцію
        const transactionData: any = {
          product_id: item.product.id,
          quantity: item.quantity,
          transaction_type: "production",
          reference_id: shiftId,
          notes: `Виробництво на зміні #${shiftId} (автоматичне додавання при закритті зміни)`,
        };

        // Додаємо warehouse_id, якщо він є
        if (mainWarehouse?.id) {
          transactionData.warehouse_id = mainWarehouse.id;
        }

        const { error: transactionError, data: transactionDataResult } =
          await supabase
            .from("inventory_transactions")
            .insert(transactionData)
            .select();

        if (transactionError) {
          console.error(
            "Error creating inventory transaction:",
            transactionError,
            "Transaction data:",
            transactionData
          );
          transactionErrors.push(
            `Помилка створення транзакції для продукту ${item.product.name}: ${transactionError.message}`
          );
          // Продовжуємо обробку інших продуктів
        } else {
          console.log(
            "Successfully created inventory transaction:",
            transactionDataResult
          );
        }
      }

      // Якщо є помилки створення транзакцій, повертаємо їх
      if (transactionErrors.length > 0) {
        console.error("Errors during transaction creation:", transactionErrors);
        return {
          success: false,
          error: `Помилки при створенні транзакцій:\n${transactionErrors.join("\n")}`,
        };
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

      // 4. Формуємо та відправляємо сповіщення в Telegram
      const productionSummary = shiftData.production?.reduce(
        (
          acc: Record<string, number>,
          item: {
            quantity: number;
            product: {
              name: string;
              category?: {
                name: string;
              };
            };
          }
        ) => {
          const category = item.product.category?.name || "Без категорії";
          acc[category] = (acc[category] || 0) + item.quantity;
          return acc;
        },
        {} as Record<string, number>
      );

      // Підраховуємо загальну кількість виробленої продукції
      let totalProduction = 0;
      if (productionSummary) {
        for (const quantity of Object.values(productionSummary)) {
          totalProduction += quantity as number;
        }
      }

      // Групуємо продукцію за категоріями для детального звіту
      const productsByCategory: Record<
        string,
        Array<{ name: string; quantity: number }>
      > = {};

      if (shiftData.production) {
        for (const item of shiftData.production) {
          const category = item.product.category?.name || "Без категорії";
          if (!productsByCategory[category]) {
            productsByCategory[category] = [];
          }
          productsByCategory[category].push({
            name: item.product.name,
            quantity: item.quantity,
          });
        }
      }

      const message = `
<b>Зміну #${shiftId} завершено</b>

📅 Дата: ${new Date().toLocaleDateString("uk-UA")}
⏰ Час закриття: ${new Date().toLocaleTimeString("uk-UA")}

📦 Вироблено всього: <b>${totalProduction} шт</b>

📊 Вироблено по категоріях:
${Object.entries(productionSummary || {})
  .map(([category, quantity]) => `• ${category}: ${quantity} шт`)
  .join("\n")}

📋 Детальний звіт по продукції:
${Object.entries(productsByCategory)
  .map(
    ([category, products]) =>
      `<b>${category}:</b>\n${products
        .map((product) => `  • ${product.name}: ${product.quantity} шт`)
        .join("\n")}`
  )
  .join("\n\n")}
`;

      await sendTelegramMessage(message);

      // Оновлюємо кеш для сторінки інвентаря та головної сторінки
      revalidatePath("/inventory");
      revalidateTag("shifts");
      revalidatePath("/");

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
    const supabase = await createServerClient();

    const shift_date = formData.get("shift_date");
    const notes = formData.get("notes");
    const opened_at = formData.get("opened_at");

    if (!shift_date) {
      return { success: false, error: "Необхідно вказати дату зміни" };
    }

    // Формуємо об'єкт для вставки
    const insertData: {
      shift_date: string;
      notes: string | null;
      opened_at?: string;
    } = {
      shift_date: shift_date as string,
      notes: (notes as string) || null,
    };

    // Якщо вказана дата відкриття, додаємо її
    if (opened_at) {
      // Створюємо дату з компонентів, щоб уникнути проблем з часовими поясами
      const dateParts = (opened_at as string).split("-");
      const year = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]) - 1; // Місяці в JavaScript починаються з 0
      const day = parseInt(dateParts[2]);
      
      // Створюємо дату в локальному часовому поясі з часом 09:00
      const openedDate = new Date(year, month, day, 9, 0, 0, 0);
      insertData.opened_at = openedDate.toISOString();
    }
    // Якщо не вказано, opened_at буде встановлено автоматично через тригер або залишиться NULL
    // і буде використано created_at при відображенні

    try {
      const { data, error } = await supabase
        .from("shifts")
        .insert([insertData])
        .select();

      if (error) {
        console.error("Error creating shift:", error);
        return { success: false, error: error.message };
      }

      // Оновлюємо кеш для головної сторінки
      revalidateTag("shifts");
      revalidatePath("/");

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
    const supabase = await createServerClient();

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
      // Формуємо об'єкт для вставки
      const opened_at = formData.get("opened_at");
      const insertData: {
        shift_date: string;
        notes: string | null;
        opened_at?: string;
      } = {
        shift_date: shift_date as string,
        notes: (notes as string) || null,
      };

      // Якщо вказана дата відкриття, додаємо її
      if (opened_at) {
        // Створюємо дату з компонентів, щоб уникнути проблем з часовими поясами
        const dateParts = (opened_at as string).split("-");
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1; // Місяці в JavaScript починаються з 0
        const day = parseInt(dateParts[2]);
        
        // Створюємо дату в локальному часовому поясі з часом 09:00
        const openedDate = new Date(year, month, day, 9, 0, 0, 0);
        insertData.opened_at = openedDate.toISOString();
      }

      // Створюємо зміну
      const { data: shiftData, error: shiftError } = await supabase
        .from("shifts")
        .insert([insertData])
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

      // Оновлюємо кеш для головної сторінки
      revalidateTag("shifts");
      revalidatePath("/");

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

export async function updateShiftOpenedAt(formData: FormData) {
  try {
    const supabase = await createServerClient();

    const shiftId = formData.get("shift_id");
    const opened_at = formData.get("opened_at");

    if (!shiftId) {
      return { success: false, error: "Необхідно вказати ID зміни" };
    }

    if (!opened_at) {
      return { success: false, error: "Необхідно вказати дату відкриття" };
    }

    // Конвертуємо дату в формат ISO з часом
    // Створюємо дату з компонентів, щоб уникнути проблем з часовими поясами
    const dateParts = (opened_at as string).split("-");
    const year = parseInt(dateParts[0]);
    const month = parseInt(dateParts[1]) - 1; // Місяці в JavaScript починаються з 0
    const day = parseInt(dateParts[2]);
    
    // Створюємо дату в локальному часовому поясі з часом 09:00
    const openedDate = new Date(year, month, day, 9, 0, 0, 0);

    try {
      const { data, error } = await supabase
        .from("shifts")
        .update({ opened_at: openedDate.toISOString() })
        .eq("id", Number.parseInt(shiftId as string))
        .select();

      if (error) {
        console.error("Error updating shift opened_at:", error);
        return { success: false, error: error.message };
      }

      // Оновлюємо кеш для головної сторінки
      revalidateTag("shifts");
      revalidatePath("/");

      return { success: true, data: data };
    } catch (error) {
      console.error("Unexpected error in updateShiftOpenedAt:", error);
      return {
        success: false,
        error: "Сталася непередбачена помилка при оновленні дати відкриття",
      };
    }
  } catch (error) {
    console.error("Error in updateShiftOpenedAt:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при оновленні дати відкриття",
    };
  }
}

// Знайдіть функцію deleteProductCategory і замініть її на цю версію:

export async function deleteProductCategory(categoryId: number) {
  try {
    const supabase = await createServerClient();

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
    const supabase = await createServerClient();

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
    const supabase = await createServerClient();

    if (!shiftId) {
      return { success: false, error: "Необхідно вказати ID зміни" };
    }

    try {
      // 1. Отримуємо інформацію про зміну
      const { data: shiftData, error: shiftError } = await supabase
        .from("shifts")
        .select(
          `
          *,
          employees:shift_employees(
            employee:employees(*)
          )
        `
        )
        .eq("id", shiftId)
        .single();

      if (shiftError) {
        console.error("Error fetching shift data:", shiftError);
        return { success: false, error: shiftError.message };
      }

      // 2. Отримуємо інформацію про вироблену продукцію
      const { data: productionData, error: productionError } = await supabase
        .from("production")
        .select(
          `
          quantity,
          product:products (
            id,
            name
          )
        `
        )
        .eq("shift_id", shiftId);

      if (productionError) {
        console.error("Error fetching production data:", productionError);
        return { success: false, error: productionError.message };
      }

      // 3. Отримуємо ID Main warehouse для транзакцій
      const { data: mainWarehouse, error: warehouseError } = await supabase
        .from("warehouses")
        .select("id")
        .ilike("name", "%main%")
        .limit(1)
        .single();

      if (warehouseError) {
        console.error("Error fetching main warehouse:", warehouseError);
        // Продовжуємо без warehouse_id, але це може призвести до проблем
      }

      // 4. Оновлюємо кількість на складі для кожного продукту
      for (const item of productionData || []) {
        if (!item.product || !(item.product as any).id) {
          console.error("Invalid product data:", item);
          continue;
        }

        const productId = (item.product as any).id;

        // 4.1 Отримуємо поточну кількість на складі
        const { data: inventoryData, error: inventoryError } = await supabase
          .from("inventory")
          .select("id, quantity")
          .eq("product_id", productId)
          .single();

        if (inventoryError) {
          console.error("Error fetching inventory:", inventoryError);
          continue;
        }

        if (!inventoryData) {
          console.error("No inventory record found for product:", productId);
          continue;
        }

        const currentQuantity = inventoryData.quantity;
        const newQuantity = currentQuantity - item.quantity;

        // 4.2 Оновлюємо кількість на складі
        const { error: updateError } = await supabase
          .from("inventory")
          .update({
            quantity: newQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", inventoryData.id);

        if (updateError) {
          console.error("Error updating inventory:", updateError);
          continue;
        }

        // 4.3 Додаємо запис про транзакцію
        const transactionData: any = {
          product_id: productId,
          quantity: -item.quantity,
          transaction_type: "adjustment",
          reference_id: shiftId,
          notes: `Видалення зміни #${shiftId} (автоматичне віднімання при видаленні зміни)`,
          created_at: new Date().toISOString(),
        };

        // Додаємо warehouse_id, якщо він є
        if (mainWarehouse?.id) {
          transactionData.warehouse_id = mainWarehouse.id;
        }

        const { error: transactionError } = await supabase
          .from("inventory_transactions")
          .insert(transactionData);

        if (transactionError) {
          console.error(
            "Error creating inventory transaction:",
            transactionError
          );
        }
      }

      // 5. Видаляємо всі записи про виробництво для цієї зміни
      const { error: deleteProductionError } = await supabase
        .from("production")
        .delete()
        .eq("shift_id", shiftId);

      if (deleteProductionError) {
        console.error(
          "Error deleting production records:",
          deleteProductionError
        );
        return { success: false, error: deleteProductionError.message };
      }

      // 6. Видаляємо всі записи про працівників на зміні
      const { error: deleteEmployeesError } = await supabase
        .from("shift_employees")
        .delete()
        .eq("shift_id", shiftId);

      if (deleteEmployeesError) {
        console.error("Error deleting shift employees:", deleteEmployeesError);
        return { success: false, error: deleteEmployeesError.message };
      }

      // 7. Видаляємо саму зміну
      const { error: deleteShiftError } = await supabase
        .from("shifts")
        .delete()
        .eq("id", shiftId);

      if (deleteShiftError) {
        console.error("Error deleting shift:", deleteShiftError);
        return { success: false, error: deleteShiftError.message };
      }

      // Оновлюємо кеш для сторінки інвентаря та головної сторінки
      revalidatePath("/inventory");
      revalidateTag("shifts");
      revalidatePath("/");

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
    const supabase = await createServerClient();

    const id = Number(formData.get("id"));
    const name = formData.get("name");
    const description = formData.get("description");
    const category_id =
      formData.get("category_id") === ""
        ? null
        : Number(formData.get("category_id"));
    const reward =
      formData.get("reward") === "" ? null : Number(formData.get("reward"));
    const cost =
      formData.get("cost") === "" ? null : Number(formData.get("cost"));

    // Логуємо отримані дані
    console.log("updateProduct отримав такі дані:");
    console.log("ID:", id);
    console.log("Назва:", name);
    console.log("Опис:", description);
    console.log("Категорія ID:", category_id);
    console.log("Винагорода:", reward, "Тип:", typeof reward);
    console.log("Вартість:", cost, "Тип:", typeof cost);

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
        cost: cost,
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
    const supabase = await createServerClient();

    const name = formData.get("name") as string;
    const position = formData.get("position") as string;

    if (!name) {
      return {
        success: false,
        error: "Ім'я працівника обов'язкове",
      };
    }

    const { data, error } = await supabase
      .from("employees")
      .insert({
        name,
        position: position || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating employee:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
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
    const supabase = await createServerClient();

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const category_id_raw = formData.get("category_id") as string;
    const reward_raw = formData.get("reward") as string;
    const cost_raw = formData.get("cost") as string;

    // Обробка значень
    const category_id = category_id_raw === "" ? null : Number(category_id_raw);
    const reward = reward_raw === "" ? null : Number(reward_raw);
    const cost = cost_raw === "" ? null : Number(cost_raw);

    // Логування для відлагодження
    console.log("createProduct отримав такі дані:");
    console.log("Назва:", name);
    console.log("Опис:", description);
    console.log("Категорія ID:", category_id);
    console.log("Винагорода:", reward, "Тип:", typeof reward);
    console.log("Вартість:", cost, "Тип:", typeof cost);

    if (!name) {
      return { success: false, error: "Необхідно вказати назву продукту" };
    }

    try {
      const { data, error } = await supabase
        .from("products")
        .insert([{ 
          name, 
          description, 
          category_id, 
          reward, 
          cost,
          product_type: "finished" // Встановлюємо тип продукту як готову продукцію
        }])
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
    const supabase = await createServerClient();

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
    const supabase = await createServerClient();

    if (!shiftId) {
      console.error("Shift ID is required");
      return null;
    }

    try {
      const { data: shift, error: shiftError } = await supabase
        .from("shifts")
        .select("*")
        .eq("id", shiftId)
        .maybeSingle();

      if (shiftError) {
        const errMsg =
          shiftError?.message ??
          (shiftError as { code?: string })?.code ??
          String(shiftError);
        console.error("Error fetching shift:", errMsg);
        return null;
      }

      if (!shift) {
        return null;
      }

      const { data: employees, error: employeesError } = await supabase
        .from("shift_employees")
        .select("*, employee:employees(*)")
        .eq("shift_id", shiftId);

      if (employeesError) {
        const errMsg =
          employeesError?.message ??
          (employeesError as { code?: string })?.code ??
          String(employeesError);
        console.error("Error fetching shift employees:", errMsg);
        return null;
      }

      const { data: production, error: productionError } = await supabase
        .from("production")
        .select("*, product:products(*, category:product_categories(*))")
        .eq("shift_id", shiftId);

      if (productionError) {
        const errMsg =
          productionError?.message ??
          (productionError as { code?: string })?.code ??
          String(productionError);
        console.error("Error fetching production:", errMsg);
        return null;
      }

      return {
        ...shift,
        employees: employees as any,
        production: production as any,
      };
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : String(error);
      console.error("Unexpected error in getShiftDetails:", errMsg);
      return null;
    }
  } catch (error) {
    const errMsg =
      error instanceof Error ? error.message : String(error);
    console.error("Error in getShiftDetails:", errMsg);
    return null;
  }
}

export async function manuallyUpdateInventoryFromProduction() {
  try {
    const supabase = await createServerClient();

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
    const supabase = await createServerClient();
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
    const supabase = await createServerClient();
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
    const supabase = await createServerClient();
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
    const supabase = await createServerClient();
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);

    if (error) {
      console.error("Error deleting task:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in deleteTask:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при видаленні задачі",
    };
  }
}

export async function getActiveTasks() {
  try {
    const supabase = await createServerClient();
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

export async function getExpenseCategories() {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("expense_categories")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching expense categories:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Failed to fetch expense categories:", err);
    throw err;
  }
}

export async function createExpenseCategory(
  name: string,
  description: string | null
) {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("expense_categories")
      .insert([{ name, description }])
      .select()
      .single();

    if (error) {
      console.error("Error creating expense category:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Error in createExpenseCategory:", error);
    throw error;
  }
}

export async function deleteExpenseCategory(id: number) {
  try {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("expense_categories")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting expense category:", error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error("Error in deleteExpenseCategory:", error);
    throw error;
  }
}

export async function updateExpenseCategory(
  id: number,
  name: string,
  description: string | null
) {
  try {
    const supabase = await createServerClient();

    if (!name.trim()) {
      throw new Error("Назва категорії не може бути порожньою");
    }

    const { data, error } = await supabase
      .from("expense_categories")
      .update({ name, description })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating expense category:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Error in updateExpenseCategory:", error);
    throw error;
  }
}

export async function getExpenses() {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("expenses")
      .select(
        `
        *,
        category:expense_categories(*)
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching expenses:", error);
      return [];
    }

    return data;
  } catch (error) {
    console.error("Error in getExpenses:", error);
    return [];
  }
}

export async function createExpense(
  category_id: number,
  amount: number,
  description: string,
  date?: string
) {
  try {
    if (!category_id || amount <= 0) {
      throw new Error("Некоректні дані для створення витрати");
    }

    const supabase = await createServerClient();

    // Перевіряємо існування категорії
    const { data: category, error: categoryError } = await supabase
      .from("expense_categories")
      .select("id")
      .eq("id", category_id)
      .single();

    if (categoryError || !category) {
      throw new Error("Категорія витрат не знайдена");
    }

    const dateValue = date
      ? new Date(date).toISOString()
      : new Date().toISOString();

    const { data, error } = await supabase
      .from("expenses")
      .insert([
        {
          category_id,
          amount,
          description: description?.trim() || "",
          date: dateValue,
        },
      ])
      .select(
        `
        *,
        category:expense_categories(*)
      `
      )
      .single();

    if (error) {
      console.error("Error creating expense:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Error in createExpense:", error);
    throw error;
  }
}

const RAW_REPAYMENT_CATEGORY_NAME = "Погашення доставки (сировина)";

export async function createRawCostRepayment(
  date: string,
  amount: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!date || amount <= 0) {
      return { ok: false, error: "Вкажіть дату та суму більше нуля" };
    }

    const categories = await getExpenseCategories();
    let category = (categories as { id: number; name: string }[]).find(
      (c) => c.name === RAW_REPAYMENT_CATEGORY_NAME
    );
    if (!category) {
      const created = await createExpenseCategory(RAW_REPAYMENT_CATEGORY_NAME, null);
      category = { id: created.id, name: created.name };
    }

    await createExpense(category.id, amount, "Погашення доставки сировина", date);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Помилка при збереженні";
    return { ok: false, error: message };
  }
}

export async function deleteExpense(id: number) {
  try {
    const supabase = await createServerClient();

    const { error } = await supabase.from("expenses").delete().eq("id", id);

    if (error) {
      console.error("Error deleting expense:", error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error("Error in deleteExpense:", error);
    throw error;
  }
}

export async function updateExpense(
  id: number,
  category_id: number,
  amount: number,
  description: string
) {
  try {
    if (!id || !category_id || amount <= 0) {
      throw new Error("Некоректні дані для оновлення витрати");
    }

    const supabase = await createServerClient();

    // Перевіряємо існування категорії
    const { data: category, error: categoryError } = await supabase
      .from("expense_categories")
      .select("id")
      .eq("id", category_id)
      .single();

    if (categoryError || !category) {
      throw new Error("Категорія витрат не знайдена");
    }

    const { data, error } = await supabase
      .from("expenses")
      .update({
        category_id,
        amount,
        description: description?.trim() || "",
      })
      .eq("id", id)
      .select(
        `
        *,
        category:expense_categories(*)
      `
      )
      .single();

    if (error) {
      console.error("Error updating expense:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Error in updateExpense:", error);
    throw error;
  }
}

export async function updateEmployee(formData: FormData) {
  try {
    const supabase = await createServerClient();

    const id = Number(formData.get("id"));
    const name = formData.get("name") as string;
    const position = formData.get("position") as string;

    if (!id || !name) {
      return {
        success: false,
        error: "Необхідно вказати ID та ім'я працівника",
      };
    }

    const { data, error } = await supabase
      .from("employees")
      .update({
        name,
        position: position || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating employee:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error in updateEmployee:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при оновленні працівника",
    };
  }
}

// Оновлення задачі
export async function updateTask(
  taskId: number,
  data: {
    title: string;
    description: string | null;
    priority: "low" | "medium" | "high";
    due_date: string | null;
    status: "pending" | "completed";
  }
) {
  try {
    console.log("Updating task:", { taskId, data });
    const supabase = await createServerClient();

    // Спочатку отримаємо поточну задачу
    const { data: currentTask, error: fetchError } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (fetchError) {
      console.error("Error fetching task:", fetchError);
      return { success: false, error: fetchError.message };
    }

    console.log("Current task data:", currentTask);

    const updateData = {
      title: data.title,
      description: data.description,
      priority: data.priority,
      due_date: data.due_date,
      status: data.status,
      completed_at:
        data.status === "completed" ? new Date().toISOString() : null,
    };
    console.log("Update data:", updateData);

    const { error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", taskId);

    if (error) {
      console.error("Error updating task:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in updateTask:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при оновленні задачі",
    };
  }
}

// Отримання списку постачальників
export async function getSuppliers(): Promise<Supplier[]> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching suppliers:", error);
      return [];
    }

    return data as Supplier[];
  } catch (error) {
    console.error("Error in getSuppliers:", error);
    return [];
  }
}

// Створення постачальника
export async function createSupplier(formData: FormData) {
  try {
    const supabase = await createServerClient();

    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    const notes = formData.get("notes") as string;

    if (!name) {
      return {
        success: false,
        error: "Назва постачальника обов'язкова",
      };
    }

    const { data, error } = await supabase
      .from("suppliers")
      .insert({
        name,
        phone: phone || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating supplier:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error in createSupplier:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при створенні постачальника",
    };
  }
}

// Оновлення постачальника
export async function updateSupplier(formData: FormData) {
  try {
    const supabase = await createServerClient();

    const id = Number(formData.get("id"));
    const name = formData.get("name") as string;
    const phone = formData.get("phone") as string;
    const notes = formData.get("notes") as string;

    if (!id || !name) {
      return {
        success: false,
        error: "Необхідно вказати ID та назву постачальника",
      };
    }

    const { data, error } = await supabase
      .from("suppliers")
      .update({
        name,
        phone: phone || null,
        notes: notes || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating supplier:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error in updateSupplier:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при оновленні постачальника",
    };
  }
}

// Видалення постачальника
export async function deleteSupplier(supplierId: number) {
  try {
    const supabase = await createServerClient();

    if (!supplierId) {
      return { success: false, error: "Необхідно вказати ID постачальника" };
    }

    const { error } = await supabase
      .from("suppliers")
      .delete()
      .eq("id", supplierId);

    if (error) {
      console.error("Error deleting supplier:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Error in deleteSupplier:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при видаленні постачальника",
    };
  }
}

// Масове додавання постачальників
export async function createSuppliersBatch(
  suppliers: Array<{
    name: string;
    phone?: string | null;
    notes?: string | null;
  }>
) {
  try {
    const supabase = await createServerClient();

    if (!suppliers || suppliers.length === 0) {
      return {
        success: false,
        error: "Список постачальників не може бути порожнім",
      };
    }

    // Валідація та очищення даних
    const validSuppliers = suppliers
      .map((supplier) => ({
        name: (supplier.name || "").trim(),
        phone: supplier.phone ? supplier.phone.trim() || null : null,
        notes: supplier.notes ? supplier.notes.trim() || null : null,
      }))
      .filter((supplier) => supplier.name.length > 0);

    if (validSuppliers.length === 0) {
      return {
        success: false,
        error: "Немає валідних постачальників для додавання",
      };
    }

    const { data, error } = await supabase
      .from("suppliers")
      .insert(validSuppliers)
      .select();

    if (error) {
      console.error("Error creating suppliers batch:", error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data,
      created: data.length,
      total: suppliers.length,
    };
  } catch (error) {
    console.error("Error in createSuppliersBatch:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при масовому додаванні постачальників",
    };
  }
}

// Отримання складів
export async function getWarehouses(): Promise<Warehouse[]> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("warehouses")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching warehouses:", error);
      return [];
    }

    return data as Warehouse[];
  } catch (error) {
    console.error("Error in getWarehouses:", error);
    return [];
  }
}

export async function getSupplierDeliveries(): Promise<SupplierDelivery[]> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("supplier_deliveries")
      .select(
        `
        *,
        supplier:suppliers(*),
        product:products!supplier_deliveries_product_id_fkey(*, category:product_categories(*)),
        material_product:products!supplier_deliveries_material_product_id_fkey(*, category:product_categories(*)),
        warehouse:warehouses(*)
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching supplier deliveries:", error);
      return [];
    }

    return data as SupplierDelivery[];
  } catch (error) {
    console.error("Error in getSupplierDeliveries:", error);
    return [];
  }
}

export async function getSupplierAdvanceTransactions(): Promise<SupplierAdvanceTransaction[]> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("supplier_advance_transactions")
      .select("*, supplier:suppliers(*)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching supplier advance transactions:", error);
      return [];
    }

    return data as SupplierAdvanceTransaction[];
  } catch (error) {
    console.error("Error in getSupplierAdvanceTransactions:", error);
    return [];
  }
}

export async function createSupplierDelivery(formData: FormData) {
  try {
    const supabase = await createServerClient();

    const supplierId = Number(formData.get("supplier_id"));
    const productId = Number(formData.get("product_id"));
    const warehouseId = Number(formData.get("warehouse_id"));
    const quantity = Number(formData.get("quantity"));
    const pricePerUnitRaw = formData.get("price_per_unit");
    const pricePerUnit =
      pricePerUnitRaw !== null &&
      pricePerUnitRaw !== undefined &&
      String(pricePerUnitRaw).trim() !== ""
        ? Math.round(Number(pricePerUnitRaw) * 100) / 100
        : null;
    const deliveryDate = formData.get("delivery_date") as string;
    const materialProductIdRaw = formData.get("material_product_id");
    const materialProductId =
      materialProductIdRaw !== null &&
      materialProductIdRaw !== undefined &&
      String(materialProductIdRaw).trim() !== ""
        ? Number(materialProductIdRaw)
        : null;
    const materialQuantityRaw = formData.get("material_quantity");
    const materialQuantity =
      materialQuantityRaw !== null &&
      materialQuantityRaw !== undefined &&
      String(materialQuantityRaw).trim() !== ""
        ? Number(materialQuantityRaw)
        : null;

    if (!supplierId || !productId || !warehouseId || !quantity) {
      return {
        success: false,
        error: "Необхідно заповнити всі обов'язкові поля",
      };
    }

    if (quantity <= 0) {
      return {
        success: false,
        error: "Кількість повинна бути більше нуля",
      };
    }

    if (
      materialQuantity !== null &&
      (materialQuantity < 0 || (materialProductId === null || materialProductId === 0))
    ) {
      return {
        success: false,
        error: "При вказанні кількості матеріалів оберіть товар з категорії «Матеріали»",
      };
    }

    const insertPayload: Record<string, unknown> = {
      supplier_id: supplierId,
      product_id: productId,
      warehouse_id: warehouseId,
      quantity: quantity,
      price_per_unit: pricePerUnit,
      created_at: new Date().toISOString(),
    };
    if (deliveryDate) {
      insertPayload.created_at = new Date(
        deliveryDate + "T12:00:00.000Z"
      ).toISOString();
    }
    if (materialProductId != null && materialQuantity != null && materialQuantity > 0) {
      insertPayload.material_product_id = materialProductId;
      insertPayload.material_quantity = materialQuantity;
    }

    const { data, error } = await supabase
      .from("supplier_deliveries")
      .insert(insertPayload)
      .select(
        `
        *,
        supplier:suppliers(*),
        product:products!supplier_deliveries_product_id_fkey(*, category:product_categories(*)),
        material_product:products!supplier_deliveries_material_product_id_fkey(*, category:product_categories(*)),
        warehouse:warehouses(*)
      `
      )
      .single();

    if (error) {
      console.error("Error creating supplier delivery:", error);
      return { success: false, error: error.message };
    }

    const materialQty = Number(materialQuantity ?? 0);
    const materialPid = materialProductId ?? 0;
    if (materialQty > 0 && materialPid) {
      const { error: txError } = await supabase.from("inventory_transactions").insert({
        product_id: materialPid,
        quantity: materialQty,
        transaction_type: "shipment",
        reference_id: data?.id ?? null,
        warehouse_id: warehouseId,
        notes: `Видача матеріалів постачальнику (поставка #${data?.id ?? ""})`,
      });
      if (txError) {
        console.error("Error creating material shipment transaction:", txError);
        return {
          success: false,
          error: "Не вдалося списати матеріали зі складу. Транзакцію не створено.",
        };
      }

      const balanceDelta = materialQty - quantity;
      const { data: supplierRow } = await supabase
        .from("suppliers")
        .select("materials_balance")
        .eq("id", supplierId)
        .single();
      const currentBalance = Number(supplierRow?.materials_balance ?? 0);
      const { error: balanceError } = await supabase
        .from("suppliers")
        .update({ materials_balance: currentBalance + balanceDelta })
        .eq("id", supplierId);
      if (balanceError) {
        console.error("Error updating supplier materials balance:", balanceError);
        return {
          success: false,
          error: "Не вдалося оновити баланс матеріалів постачальника.",
        };
      }
    }

    const purchaseAmount =
      pricePerUnit != null
        ? Math.round(Number(quantity) * pricePerUnit * 100) / 100
        : 0;
    if (purchaseAmount > 0 && data?.id) {
      const deliveryCreatedAt = (data as { created_at?: string }).created_at ?? new Date().toISOString();
      const { data: advances } = await supabase
        .from("supplier_advance_transactions")
        .select("amount")
        .eq("supplier_id", supplierId)
        .lte("created_at", deliveryCreatedAt);
      const advancesSum = (advances ?? []).reduce(
        (s, r) => s + Number(r.amount ?? 0),
        0,
      );
      const { data: prevDeliveries } = await supabase
        .from("supplier_deliveries")
        .select("advance_used")
        .eq("supplier_id", supplierId)
        .lt("created_at", deliveryCreatedAt);
      const advanceUsedSum = (prevDeliveries ?? []).reduce(
        (s, r) => s + Number(r.advance_used ?? 0),
        0,
      );
      const availableAdvance = Math.max(
        0,
        Math.round((advancesSum - advanceUsedSum) * 100) / 100,
      );
      const deduct = Math.min(purchaseAmount, availableAdvance);
      const deductRounded = Math.round(deduct * 100) / 100;

      await supabase
        .from("supplier_deliveries")
        .update({ advance_used: deductRounded })
        .eq("id", data.id);

      const { data: supplierRow } = await supabase
        .from("suppliers")
        .select("advance")
        .eq("id", supplierId)
        .single();
      const currentAdvance = Number(supplierRow?.advance ?? 0);
      const newAdvance = Math.round((currentAdvance - deductRounded) * 100) / 100;
      const { error: advanceError } = await supabase
        .from("suppliers")
        .update({ advance: Math.max(0, newAdvance) })
        .eq("id", supplierId);
      if (advanceError) {
        console.error("Error updating supplier advance:", advanceError);
      }
    }

    revalidatePath("/transactions/suppliers");
    revalidatePath("/suppliers");

    return { success: true, data };
  } catch (error) {
    console.error("Error in createSupplierDelivery:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при створенні транзакції",
    };
  }
}

export async function addSupplierAdvance(formData: FormData) {
  try {
    const supabase = await createServerClient();

    const supplierId = Number(formData.get("supplier_id"));
    const advanceAmount = Number(formData.get("advance"));

    if (!supplierId) {
      return {
        success: false,
        error: "Оберіть постачальника",
      };
    }

    if (!advanceAmount || advanceAmount <= 0) {
      return {
        success: false,
        error: "Введіть коректну суму авансу",
      };
    }

    const { data: supplierRow } = await supabase
      .from("suppliers")
      .select("advance")
      .eq("id", supplierId)
      .single();

    const currentAdvance = Number(supplierRow?.advance ?? 0);
    const newAdvance = Math.round((currentAdvance + advanceAmount) * 100) / 100;

    const deliveryDate = formData.get("delivery_date") as string;
    const createdAt = deliveryDate
      ? new Date(deliveryDate + "T12:00:00.000Z").toISOString()
      : new Date().toISOString();

    const { error: insertError } = await supabase
      .from("supplier_advance_transactions")
      .insert({
        supplier_id: supplierId,
        amount: advanceAmount,
        created_at: createdAt,
      });

    if (insertError) {
      console.error("Error inserting supplier advance transaction:", insertError);
      return { success: false, error: insertError.message };
    }

    const { error } = await supabase
      .from("suppliers")
      .update({ advance: Math.max(0, newAdvance) })
      .eq("id", supplierId);

    if (error) {
      console.error("Error updating supplier advance:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/transactions/suppliers");
    revalidatePath("/suppliers");

    return { success: true };
  } catch (error) {
    console.error("Error in addSupplierAdvance:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при додаванні авансу",
    };
  }
}

export async function deleteSupplierAdvanceTransaction(advanceId: number) {
  try {
    const supabase = await createServerClient();

    if (!advanceId) {
      return { success: false, error: "Необхідно вказати ID операції авансу" };
    }

    const { data: advanceRow, error: getError } = await supabase
      .from("supplier_advance_transactions")
      .select("supplier_id, amount")
      .eq("id", advanceId)
      .single();

    if (getError || !advanceRow) {
      return { success: false, error: "Операцію авансу не знайдено" };
    }

    const amount = Math.round(Number(advanceRow.amount) * 100) / 100;
    const supplierId = advanceRow.supplier_id;

    const { error: deleteError } = await supabase
      .from("supplier_advance_transactions")
      .delete()
      .eq("id", advanceId);

    if (deleteError) {
      console.error("Error deleting advance transaction:", deleteError);
      return { success: false, error: deleteError.message };
    }

    const { data: remainingAdvances } = await supabase
      .from("supplier_advance_transactions")
      .select("amount")
      .eq("supplier_id", supplierId);
    const advancesSum = (remainingAdvances ?? []).reduce(
      (s, r) => s + Number(r.amount ?? 0),
      0,
    );

    const { data: deliveries } = await supabase
      .from("supplier_deliveries")
      .select("advance_used")
      .eq("supplier_id", supplierId);
    const advanceUsedSum = (deliveries ?? []).reduce(
      (s, r) => s + Number((r as { advance_used?: number }).advance_used ?? 0),
      0,
    );

    const newAdvance = Math.round((advancesSum - advanceUsedSum) * 100) / 100;

    await supabase
      .from("suppliers")
      .update({ advance: Math.max(0, newAdvance) })
      .eq("id", supplierId);

    revalidatePath("/transactions/suppliers");
    revalidatePath("/suppliers");

    return { success: true };
  } catch (error) {
    console.error("Error in deleteSupplierAdvanceTransaction:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при видаленні авансу",
    };
  }
}

export async function updateSupplierAdvanceTransaction(formData: FormData) {
  try {
    const supabase = await createServerClient();

    const advanceId = Number(formData.get("advance_id"));
    const supplierId = Number(formData.get("supplier_id"));
    const amount = Math.round(Number(formData.get("amount")) * 100) / 100;
    const dateRaw = formData.get("date") as string;
    const createdAt =
      dateRaw && dateRaw.trim().length >= 10
        ? new Date(dateRaw.trim().slice(0, 10) + "T12:00:00.000Z").toISOString()
        : new Date().toISOString();

    if (!advanceId || !supplierId) {
      return {
        success: false,
        error: "Необхідно вказати ID та постачальника",
      };
    }

    if (!amount || amount <= 0) {
      return {
        success: false,
        error: "Введіть коректну суму авансу",
      };
    }

    const { data: currentAdvance, error: getError } = await supabase
      .from("supplier_advance_transactions")
      .select("supplier_id, amount")
      .eq("id", advanceId)
      .single();

    if (getError || !currentAdvance) {
      return { success: false, error: "Операцію авансу не знайдено" };
    }

    const oldSupplierId = currentAdvance.supplier_id;
    const oldAmount = Math.round(Number(currentAdvance.amount) * 100) / 100;

    const { error: updateError } = await supabase
      .from("supplier_advance_transactions")
      .update({
        supplier_id: supplierId,
        amount,
        created_at: createdAt,
      })
      .eq("id", advanceId);

    if (updateError) {
      console.error("Error updating advance transaction:", updateError);
      return { success: false, error: updateError.message };
    }

    if (oldSupplierId === supplierId) {
      const delta = amount - oldAmount;
      const { data: row } = await supabase
        .from("suppliers")
        .select("advance")
        .eq("id", supplierId)
        .single();
      const currentAdv = Number(row?.advance ?? 0);
      const newAdv = Math.round((currentAdv + delta) * 100) / 100;
      await supabase
        .from("suppliers")
        .update({ advance: Math.max(0, newAdv) })
        .eq("id", supplierId);
    } else {
      const { data: oldRow } = await supabase
        .from("suppliers")
        .select("advance")
        .eq("id", oldSupplierId)
        .single();
      const oldBal = Number(oldRow?.advance ?? 0);
      await supabase
        .from("suppliers")
        .update({
          advance: Math.max(0, Math.round((oldBal - oldAmount) * 100) / 100),
        })
        .eq("id", oldSupplierId);

      const { data: newRow } = await supabase
        .from("suppliers")
        .select("advance")
        .eq("id", supplierId)
        .single();
      const newBal = Number(newRow?.advance ?? 0);
      await supabase
        .from("suppliers")
        .update({
          advance: Math.max(0, Math.round((newBal + amount) * 100) / 100),
        })
        .eq("id", supplierId);
    }

    revalidatePath("/transactions/suppliers");
    revalidatePath("/suppliers");

    return { success: true };
  } catch (error) {
    console.error("Error in updateSupplierAdvanceTransaction:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при оновленні авансу",
    };
  }
}

export async function updateSupplierDelivery(formData: FormData) {
  try {
    const supabase = await createServerClient();

    const deliveryId = Number(formData.get("delivery_id"));
    const supplierId = Number(formData.get("supplier_id"));
    const productId = Number(formData.get("product_id"));
    const warehouseId = Number(formData.get("warehouse_id"));
    const quantity = Number(formData.get("quantity"));
    const pricePerUnitRaw = formData.get("price_per_unit");
    const pricePerUnit =
      pricePerUnitRaw !== null &&
      pricePerUnitRaw !== undefined &&
      String(pricePerUnitRaw).trim() !== ""
        ? Math.round(Number(pricePerUnitRaw) * 100) / 100
        : null;
    const deliveryDateRaw = formData.get("delivery_date");
    const deliveryDate =
      typeof deliveryDateRaw === "string" && deliveryDateRaw.trim().length >= 10
        ? deliveryDateRaw.trim().slice(0, 10)
        : null;
    const materialProductIdRaw = formData.get("material_product_id");
    const materialProductId =
      materialProductIdRaw !== null &&
      materialProductIdRaw !== undefined &&
      String(materialProductIdRaw).trim() !== ""
        ? Number(materialProductIdRaw)
        : null;
    const materialQuantityRaw = formData.get("material_quantity");
    const materialQuantity =
      materialQuantityRaw !== null &&
      materialQuantityRaw !== undefined &&
      String(materialQuantityRaw).trim() !== ""
        ? Math.round(Number(materialQuantityRaw) * 100) / 100
        : null;

    if (!deliveryId || !supplierId || !productId || !warehouseId || !quantity) {
      return {
        success: false,
        error: "Необхідно заповнити всі обов'язкові поля",
      };
    }

    if (quantity <= 0) {
      return {
        success: false,
        error: "Кількість повинна бути більше нуля",
      };
    }

    const { data: currentDelivery, error: getError } = await supabase
      .from("supplier_deliveries")
      .select("quantity, product_id, warehouse_id, material_product_id, material_quantity, price_per_unit, advance_used, created_at")
      .eq("id", deliveryId)
      .single();

    if (getError || !currentDelivery) {
      return {
        success: false,
        error: "Транзакцію не знайдено",
      };
    }

    const createdAt = deliveryDate
      ? new Date(deliveryDate + "T12:00:00.000Z").toISOString()
      : undefined;

    const updateData: Record<string, unknown> = {
      supplier_id: supplierId,
      product_id: productId,
      warehouse_id: warehouseId,
      quantity: quantity,
      price_per_unit: pricePerUnit,
      material_product_id: materialProductId ?? null,
      material_quantity: materialQuantity ?? null,
    };
    if (createdAt !== undefined) {
      updateData.created_at = createdAt;
    }

    const { data, error } = await supabase
      .from("supplier_deliveries")
      .update(updateData)
      .eq("id", deliveryId)
      .select(
        `
        *,
        supplier:suppliers(*),
        product:products!supplier_deliveries_product_id_fkey(*, category:product_categories(*)),
        material_product:products!supplier_deliveries_material_product_id_fkey(*, category:product_categories(*)),
        warehouse:warehouses(*)
      `
      )
      .single();

    if (error) {
      console.error("Error updating supplier delivery:", error);
      return { success: false, error: error.message };
    }

    const { data: inventoryTransaction } = await supabase
      .from("inventory_transactions")
      .select("id")
      .eq("transaction_type", "income")
      .eq("reference_id", deliveryId)
      .single();

    if (inventoryTransaction) {
      const oldQuantity = Number(currentDelivery.quantity);
      const newQuantity = Number(quantity);
      const quantityDiff = newQuantity - oldQuantity;

      const warehouseChanged = currentDelivery.warehouse_id !== warehouseId;
      const productChanged = currentDelivery.product_id !== productId;

      if (warehouseChanged || productChanged) {
        if (currentDelivery.warehouse_id && currentDelivery.product_id) {
          const { data: oldInventory } = await supabase
            .from("warehouse_inventory")
            .select("quantity")
            .eq("warehouse_id", currentDelivery.warehouse_id)
            .eq("product_id", currentDelivery.product_id)
            .single();

          if (oldInventory) {
            const updatedOldQuantity = Math.max(0, Number(oldInventory.quantity) - oldQuantity);
            await supabase
              .from("warehouse_inventory")
              .update({
                quantity: updatedOldQuantity,
                updated_at: new Date().toISOString(),
              })
              .eq("warehouse_id", currentDelivery.warehouse_id)
              .eq("product_id", currentDelivery.product_id);
          }
        }

        const { data: newInventory } = await supabase
          .from("warehouse_inventory")
          .select("quantity")
          .eq("warehouse_id", warehouseId)
          .eq("product_id", productId)
          .single();

        if (newInventory) {
          const updatedNewQuantity = Number(newInventory.quantity) + newQuantity;
          await supabase
            .from("warehouse_inventory")
            .update({
              quantity: updatedNewQuantity,
              updated_at: new Date().toISOString(),
            })
            .eq("warehouse_id", warehouseId)
            .eq("product_id", productId);
        } else {
          await supabase
            .from("warehouse_inventory")
            .insert({
              warehouse_id: warehouseId,
              product_id: productId,
              quantity: newQuantity,
              updated_at: new Date().toISOString(),
            });
        }
        } else if (quantityDiff !== 0) {
        const { data: currentInventory } = await supabase
          .from("warehouse_inventory")
          .select("quantity")
          .eq("warehouse_id", warehouseId)
          .eq("product_id", productId)
          .single();

        if (currentInventory) {
          const updatedQuantity = Math.max(0, Number(currentInventory.quantity) + quantityDiff);
          await supabase
            .from("warehouse_inventory")
            .update({
              quantity: updatedQuantity,
              updated_at: new Date().toISOString(),
            })
            .eq("warehouse_id", warehouseId)
            .eq("product_id", productId);
        }
      }

      const { error: updateTransactionError } = await supabase
        .from("inventory_transactions")
        .update({
          product_id: productId,
          quantity: quantity,
          warehouse_id: warehouseId,
        })
        .eq("id", inventoryTransaction.id);

      if (updateTransactionError) {
        console.error("Error updating inventory transaction:", updateTransactionError);
      }
    }

    const oldRawQty = Number(currentDelivery.quantity);
    const oldMaterialQty = Number(currentDelivery.material_quantity ?? 0);
    const oldMaterialPid = currentDelivery.material_product_id ?? null;
    const newMaterialQty = Number(materialQuantity ?? 0);
    const newMaterialPid = materialProductId ?? null;

    const { data: materialShipment } = await supabase
      .from("inventory_transactions")
      .select("id, product_id, quantity, warehouse_id")
      .eq("transaction_type", "shipment")
      .eq("reference_id", deliveryId)
      .maybeSingle();

    if (oldMaterialQty > 0 && oldMaterialPid && materialShipment) {
      const { data: whInv } = await supabase
        .from("warehouse_inventory")
        .select("quantity")
        .eq("warehouse_id", materialShipment.warehouse_id ?? warehouseId)
        .eq("product_id", oldMaterialPid)
        .single();
      if (whInv) {
        await supabase
          .from("warehouse_inventory")
          .update({
            quantity: Number(whInv.quantity) + oldMaterialQty,
            updated_at: new Date().toISOString(),
          })
          .eq("warehouse_id", materialShipment.warehouse_id ?? warehouseId)
          .eq("product_id", oldMaterialPid);
      }
      await supabase
        .from("inventory_transactions")
        .delete()
        .eq("id", materialShipment.id);
      const { data: supRow } = await supabase
        .from("suppliers")
        .select("materials_balance")
        .eq("id", supplierId)
        .single();
      const curBal = Number(supRow?.materials_balance ?? 0);
      await supabase
        .from("suppliers")
        .update({
          materials_balance: curBal - (oldMaterialQty - oldRawQty),
        })
        .eq("id", supplierId);
    }

    if (newMaterialQty > 0 && newMaterialPid) {
      const { error: txErr } = await supabase.from("inventory_transactions").insert({
        product_id: newMaterialPid,
        quantity: newMaterialQty,
        transaction_type: "shipment",
        reference_id: deliveryId,
        warehouse_id: warehouseId,
        notes: `Видача матеріалів постачальнику (поставка #${deliveryId})`,
      });
      if (txErr) {
        console.error("Error creating material shipment on update:", txErr);
      } else {
        const { data: supRow2 } = await supabase
          .from("suppliers")
          .select("materials_balance")
          .eq("id", supplierId)
          .single();
        const curBal2 = Number(supRow2?.materials_balance ?? 0);
        await supabase
          .from("suppliers")
          .update({
            materials_balance: curBal2 + (newMaterialQty - quantity),
          })
          .eq("id", supplierId);
      }
    }

    const newAmount =
      pricePerUnit != null
        ? Math.round(Number(quantity) * pricePerUnit * 100) / 100
        : 0;
    const oldAdvanceUsed = Number((currentDelivery as { advance_used?: number }).advance_used ?? 0);
    const deliveryCreatedAt =
      (createdAt ? new Date(createdAt) : new Date((currentDelivery as { created_at?: string }).created_at ?? 0)).toISOString();

    if (newAmount > 0) {
      const { data: advances } = await supabase
        .from("supplier_advance_transactions")
        .select("amount")
        .eq("supplier_id", supplierId)
        .lte("created_at", deliveryCreatedAt);
      const advancesSum = (advances ?? []).reduce(
        (s, r) => s + Number(r.amount ?? 0),
        0,
      );
      const { data: prevDeliveries } = await supabase
        .from("supplier_deliveries")
        .select("advance_used, created_at, id")
        .eq("supplier_id", supplierId);
      const advanceUsedSum = (prevDeliveries ?? [])
        .filter(
          (d) =>
            d.id !== deliveryId &&
            (new Date(d.created_at).getTime() < new Date(deliveryCreatedAt).getTime() ||
              (new Date(d.created_at).getTime() === new Date(deliveryCreatedAt).getTime() && (d.id as number) < deliveryId)),
        )
        .reduce((s, r) => s + Number(r.advance_used ?? 0), 0);
      const availableAdvance = Math.max(
        0,
        Math.round((advancesSum - advanceUsedSum) * 100) / 100,
      );
      const newDeduct = Math.min(newAmount, availableAdvance);
      const newDeductRounded = Math.round(newDeduct * 100) / 100;

      await supabase
        .from("supplier_deliveries")
        .update({ advance_used: newDeductRounded })
        .eq("id", deliveryId);

      const { data: supplierRow } = await supabase
        .from("suppliers")
        .select("advance")
        .eq("id", supplierId)
        .single();
      const currentAdvance = Number(supplierRow?.advance ?? 0);
      const advanceDelta = -oldAdvanceUsed + newDeductRounded;
      const newAdvance = Math.round((currentAdvance + advanceDelta) * 100) / 100;
      const { error: advanceError } = await supabase
        .from("suppliers")
        .update({ advance: Math.max(0, newAdvance) })
        .eq("id", supplierId);
      if (advanceError) {
        console.error("Error updating supplier advance:", advanceError);
      }
    } else if (oldAdvanceUsed > 0) {
      const { data: supplierRow } = await supabase
        .from("suppliers")
        .select("advance")
        .eq("id", supplierId)
        .single();
      const currentAdvance = Number(supplierRow?.advance ?? 0);
      const newAdvance = Math.round((currentAdvance + oldAdvanceUsed) * 100) / 100;
      await supabase
        .from("suppliers")
        .update({ advance: Math.max(0, newAdvance) })
        .eq("id", supplierId);
      await supabase
        .from("supplier_deliveries")
        .update({ advance_used: 0 })
        .eq("id", deliveryId);
    }

    revalidatePath("/transactions/suppliers");
    revalidatePath("/suppliers");

    return { success: true, data };
  } catch (error) {
    console.error("Error in updateSupplierDelivery:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при оновленні транзакції",
    };
  }
}

export async function deleteSupplierDelivery(deliveryId: number) {
  try {
    const supabase = await createServerClient();

    if (!deliveryId) {
      return { success: false, error: "Необхідно вказати ID транзакції" };
    }

    const { data: delivery, error: getError } = await supabase
      .from("supplier_deliveries")
      .select("quantity, product_id, warehouse_id, supplier_id, price_per_unit, advance_used")
      .eq("id", deliveryId)
      .single();

    if (getError || !delivery) {
      return { success: false, error: "Транзакцію не знайдено" };
    }

    const advanceUsed =
      (delivery as { advance_used?: number }).advance_used != null
        ? Math.round(Number((delivery as { advance_used: number }).advance_used) * 100) / 100
        : 0;
    if (advanceUsed > 0 && delivery.supplier_id) {
      const { data: supplierRow } = await supabase
        .from("suppliers")
        .select("advance")
        .eq("id", delivery.supplier_id)
        .single();
      const currentAdvance = Number(supplierRow?.advance ?? 0);
      const newAdvance = Math.round((currentAdvance + advanceUsed) * 100) / 100;
      await supabase
        .from("suppliers")
        .update({ advance: Math.max(0, newAdvance) })
        .eq("id", delivery.supplier_id);
    }

    const { data: inventoryTransaction } = await supabase
      .from("inventory_transactions")
      .select("id")
      .eq("transaction_type", "income")
      .eq("reference_id", deliveryId)
      .single();

    if (inventoryTransaction) {
      const { error: updateError } = await supabase.rpc(
        "update_warehouse_inventory_on_delete",
        {
          p_warehouse_id: delivery.warehouse_id,
          p_product_id: delivery.product_id,
          p_quantity: -delivery.quantity,
        }
      );

      if (updateError) {
        const { data: currentInventory } = await supabase
          .from("warehouse_inventory")
          .select("quantity")
          .eq("warehouse_id", delivery.warehouse_id)
          .eq("product_id", delivery.product_id)
          .single();

        if (currentInventory) {
          const newQuantity = Math.max(0, Number(currentInventory.quantity) - Number(delivery.quantity));
          const { error: manualUpdateError } = await supabase
            .from("warehouse_inventory")
            .update({
              quantity: newQuantity,
              updated_at: new Date().toISOString(),
            })
            .eq("warehouse_id", delivery.warehouse_id)
            .eq("product_id", delivery.product_id);

          if (manualUpdateError) {
            console.error("Error updating warehouse inventory:", manualUpdateError);
          }
        }
      }

      const { error: deleteTransactionError } = await supabase
        .from("inventory_transactions")
        .delete()
        .eq("id", inventoryTransaction.id);

      if (deleteTransactionError) {
        console.error("Error deleting inventory transaction:", deleteTransactionError);
      }
    }

    // Видаляємо транзакцію закупівлі
    const { error } = await supabase
      .from("supplier_deliveries")
      .delete()
      .eq("id", deliveryId);

    if (error) {
      console.error("Error deleting supplier delivery:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/transactions/suppliers");
    revalidatePath("/suppliers");

    return { success: true };
  } catch (error) {
    console.error("Error in deleteSupplierDelivery:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при видаленні транзакції",
    };
  }
}

// Отримання виробничих матеріалів
export async function getMaterials(): Promise<Product[]> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("products")
      .select("*, category:product_categories(*)")
      .eq("product_type", "material")
      .order("name");

    if (error) {
      console.error("Error fetching materials:", error);
      return [];
    }

    return data as Product[];
  } catch (error) {
    console.error("Error in getMaterials:", error);
    throw error;
  }
}

// Створення виробничого матеріалу
export async function createMaterial(formData: FormData) {
  try {
    const supabase = await createServerClient();

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const category_id_raw = formData.get("category_id") as string;
    const cost_raw = formData.get("cost") as string;

    // Обробка значень
    const category_id = category_id_raw === "" ? null : Number(category_id_raw);
    const cost = cost_raw === "" ? null : Number(cost_raw);

    console.log("createMaterial отримав такі дані:");
    console.log("Назва:", name);
    console.log("Опис:", description);
    console.log("Категорія ID:", category_id);
    console.log("Вартість:", cost, "Тип:", typeof cost);

    if (!name) {
      return { success: false, error: "Необхідно вказати назву матеріалу" };
    }

    try {
      const { data, error } = await supabase
        .from("products")
        .insert([{ 
          name, 
          description, 
          category_id, 
          cost,
          product_type: "material",
          reward: null // Матеріали не мають винагороди
        }])
        .select();

      if (error) {
        console.error("Error creating material:", error);
        return { success: false, error: error.message };
      }

      console.log("Матеріал успішно створено:", data);
      return { success: true, data: data };
    } catch (error) {
      console.error("Unexpected error in createMaterial:", error);
      return {
        success: false,
        error: "Сталася непередбачена помилка при створенні матеріалу",
      };
    }
  } catch (error) {
    console.error("Error in createMaterial:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при створенні матеріалу",
    };
  }
}

// Оновлення виробничого матеріалу
export async function updateMaterial(formData: FormData) {
  try {
    const supabase = await createServerClient();

    const id = Number(formData.get("id"));
    const name = formData.get("name");
    const description = formData.get("description");
    const category_id =
      formData.get("category_id") === ""
        ? null
        : Number(formData.get("category_id"));
    const cost =
      formData.get("cost") === "" ? null : Number(formData.get("cost"));

    console.log("updateMaterial отримав такі дані:");
    console.log("ID:", id);
    console.log("Назва:", name);
    console.log("Опис:", description);
    console.log("Категорія ID:", category_id);
    console.log("Вартість:", cost, "Тип:", typeof cost);

    if (!id || !name) {
      return {
        success: false,
        error: "Необхідно вказати ID та назву матеріалу",
      };
    }

    try {
      const updateData = {
        name: name,
        description: description,
        category_id: category_id,
        cost: cost,
        reward: null, // Матеріали не мають винагороди
        // product_type залишається 'material' - не змінюємо
      };

      console.log("Дані для оновлення:", updateData);

      const { data, error } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", id)
        .eq("product_type", "material") // Перевіряємо, що це матеріал
        .select();

      if (error) {
        console.error("Error updating material:", error);
        return { success: false, error: error.message };
      }

      console.log("Результат оновлення:", data);
      return { success: true, data: data };
    } catch (error) {
      console.error("Unexpected error in updateMaterial:", error);
      return {
        success: false,
        error: "Сталася непередбачена помилка при оновленні матеріалу",
      };
    }
  } catch (error) {
    console.error("Error in updateMaterial:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при оновленні матеріалу",
    };
  }
}

// Видалення виробничого матеріалу
export async function deleteMaterial(materialId: number) {
  try {
    const supabase = await createServerClient();

    if (!materialId) {
      return { success: false, error: "Необхідно вказати ID матеріалу" };
    }

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", materialId)
        .eq("product_type", "material"); // Перевіряємо, що це матеріал

      if (error) {
        console.error("Error deleting material:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Unexpected error in deleteMaterial:", error);
      return {
        success: false,
        error: "Сталася непередбачена помилка при видаленні матеріалу",
      };
    }
  } catch (error) {
    console.error("Error in deleteMaterial:", error);
    return {
      success: false,
      error: "Сталася непередбачена помилка при видаленні матеріалу",
    };
  }
}

// Оптимізовані функції для головної сторінки з кешуванням та обмеженням даних

// Отримання останніх змін для головної сторінки (тільки для відображення)
export async function getRecentShifts(limit = 10) {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("shifts")
      .select(
        `
            *,
            employees:shift_employees(*, employee:employees(*)),
            production:production(*, product:products(*, category:product_categories(*)))
          `
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching recent shifts:", error);
      return [];
    }

    return data as ShiftWithDetails[];
  } catch (error) {
    console.error("Error in getRecentShifts:", error);
    return [];
  }
}

// Отримання кількості активних змін (тільки count, без даних)
export async function getActiveShiftsCount() {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("shifts")
      .select("id")
      .eq("status", "active");

    if (error) {
      console.error("Error fetching active shifts count:", error);
      return 0;
    }

    return data?.length || 0;
  } catch (error) {
    console.error("Error in getActiveShiftsCount:", error);
    return 0;
  }
}

// Отримання кількості працівників (тільки count)
export async function getEmployeesCount() {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase.from("employees").select("id");

    if (error) {
      console.error("Error fetching employees count:", error);
      return 0;
    }

    return data?.length || 0;
  } catch (error) {
    console.error("Error in getEmployeesCount:", error);
    return 0;
  }
}

// Отримання кількості продуктів (тільки count)
export async function getProductsCount() {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("products")
      .select("id")
      .or("product_type.eq.finished,product_type.is.null");

    if (error) {
      console.error("Error fetching products count:", error);
      return 0;
    }

    return data?.length || 0;
  } catch (error) {
    console.error("Error in getProductsCount:", error);
    return 0;
  }
}

// Отримання кількості матеріалів (тільки count)
export async function getMaterialsCount() {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("products")
      .select("id")
      .eq("product_type", "material");

    if (error) {
      console.error("Error fetching materials count:", error);
      return 0;
    }

    return data?.length || 0;
  } catch (error) {
    console.error("Error in getMaterialsCount:", error);
    return 0;
  }
}

// Отримання загальної кількості на складі (тільки сума)
export async function getTotalInventory() {
  try {
    const supabase = await createServerClient();

    const { data: oldInventoryData, error: oldInventoryError } = await supabase
      .from("inventory")
      .select("quantity, product:products(product_type, reward)");

    const { data: mainWarehouseData } = await supabase
      .from("warehouses")
      .select("id")
      .ilike("name", "%main%")
      .limit(1)
      .single();

    let warehouseInventoryTotal = 0;
    if (mainWarehouseData) {
      const { data: warehouseData, error: warehouseError } = await supabase
        .from("warehouse_inventory")
        .select("quantity, product:products(product_type)")
        .eq("warehouse_id", mainWarehouseData.id);

      if (!warehouseError && warehouseData) {
        const materials = warehouseData.filter(
          (item) => item.product?.product_type === "material"
        );
        warehouseInventoryTotal = materials.reduce(
          (sum, item) => sum + (Number(item.quantity) || 0),
          0
        );
      }
    }

    let oldInventoryTotal = 0;
    if (!oldInventoryError && oldInventoryData) {
      const finishedProducts = oldInventoryData.filter(
        (item) =>
          item.product?.product_type !== "material" &&
          (item.product?.product_type === "finished" ||
            (item.product?.product_type === null && item.product?.reward !== null))
      );
      oldInventoryTotal = finishedProducts.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0),
        0
      );
    }

    return Math.round(oldInventoryTotal + warehouseInventoryTotal);
  } catch (error) {
    console.error("Error in getTotalInventory:", error);
    return 0;
  }
}

// Оптимізована функція для завантаження всіх даних головної сторінки
export async function getHomePageData() {
  // Завантажуємо дані паралельно, але з кешуванням
  const [recentShifts, activeShiftsCount, employeesCount, productsCount, materialsCount, totalInventory, productionStats, activeTasks] = await Promise.all([
    getRecentShifts(10),
    getActiveShiftsCount(),
    getEmployeesCount(),
    getProductsCount(),
    getMaterialsCount(),
    getTotalInventory(),
    getProductionStats("year"),
    getActiveTasks(),
  ]);

  return {
    recentShifts,
    activeShiftsCount,
    employeesCount,
    productsCount,
    materialsCount,
    totalInventory,
    productionStats,
    activeTasks,
  };
}
