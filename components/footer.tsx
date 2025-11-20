import Link from "next/link";
import { Package, Users, BarChart, Boxes, CheckSquare, DollarSign, Truck, ShoppingCart } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/40 mt-auto">
      <div className="container py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Про систему */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Облік виробництва</h3>
            <p className="text-sm text-muted-foreground">
              ERP система для управління виробництвом та обліком продукції
              підприємства Форест Україна
            </p>
          </div>

          {/* Швидкі посилання */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Швидкі посилання</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/shifts"
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                >
                  <BarChart className="h-4 w-4" />
                  Зміни
                </Link>
              </li>
              <li>
                <Link
                  href="/employees"
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                >
                  <Users className="h-4 w-4" />
                  Працівники
                </Link>
              </li>
              <li>
                <Link
                  href="/products"
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                >
                  <Package className="h-4 w-4" />
                  Продукція
                </Link>
              </li>
            </ul>
          </div>

          {/* Управління */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Управління</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/inventory"
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                >
                  <Boxes className="h-4 w-4" />
                  Склад
                </Link>
              </li>
              <li>
                <Link
                  href="/tasks"
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                >
                  <CheckSquare className="h-4 w-4" />
                  Задачі
                </Link>
              </li>
              <li>
                <Link
                  href="/expenses"
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                >
                  <DollarSign className="h-4 w-4" />
                  Витрати
                </Link>
              </li>
              <li>
                <Link
                  href="/suppliers"
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                >
                  <Truck className="h-4 w-4" />
                  Постачальники
                </Link>
              </li>
              <li>
                <Link
                  href="/transactions/suppliers"
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Закупка
                </Link>
              </li>
            </ul>
          </div>

          {/* Статистика */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Аналітика</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/statistics"
                  className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                >
                  <BarChart className="h-4 w-4" />
                  Статистика виробництва
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Нижня частина */}
        <div className="pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {currentYear} Форест Україна. Всі права захищені.
          </p>
          <p className="text-sm text-muted-foreground">
            ERP система для обліку виробництва
          </p>
        </div>
      </div>
    </footer>
  );
}

