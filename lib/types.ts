export interface Employee {
  id: number;
  name: string;
  position: string | null;
  created_at: string;
}

export interface Shift {
  id: number;
  shift_date: string;
  status: "active" | "completed";
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  opened_at: string | null;
}

export interface ShiftEmployee {
  id: number;
  shift_id: number;
  employee_id: number;
  created_at: string;
  employee?: Employee;
}

export interface ProductCategory {
  id: number;
  name: string;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  category_id: number | null;
  reward: number | null;
  cost: number | null;
  product_type?: "finished" | "raw" | "material" | null;
  created_at: string;
  category?: ProductCategory;
}

export interface Production {
  id: number;
  shift_id: number;
  product_id: number;
  quantity: number;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface ShiftWithDetails extends Shift {
  employees: (ShiftEmployee & { employee: Employee })[];
  production: (Production & { product: Product })[];
}

export interface Inventory {
  id: number;
  product_id: number;
  quantity: number;
  updated_at: string;
  product?: Product;
}

export interface InventoryTransaction {
  id: number;
  product_id: number;
  quantity: number;
  transaction_type: "production" | "shipment" | "adjustment" | "income";
  reference_id?: number | null;
  notes: string | null;
  created_at: string;
  product?: Product;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: "pending" | "completed";
  priority: "low" | "medium" | "high";
  created_at: string;
  completed_at: string | null;
  due_date: string | null;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  notes: string | null;
  advance?: number;
  materials_balance?: number;
  created_at: string;
}

export interface Warehouse {
  id: number;
  name: string;
  created_at: string;
}

export interface SupplierDelivery {
  id: number;
  supplier_id: number;
  product_id: number;
  warehouse_id: number;
  quantity: number;
  price_per_unit: number | null;
  material_product_id?: number | null;
  material_quantity?: number | null;
  created_at: string;
  supplier?: Supplier;
  product?: Product;
  material_product?: Product | null;
  warehouse?: Warehouse;
}

export interface SupplierAdvanceTransaction {
  id: number;
  supplier_id: number;
  amount: number;
  created_at: string;
  supplier?: Supplier;
}
