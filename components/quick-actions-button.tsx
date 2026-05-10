"use client";

import Link from "next/link";
import {
  Box,
  Boxes,
  Car,
  CheckSquare,
  DollarSign,
  MapPin,
  Menu,
  CalendarDays,
  Package,
  PieChart,
  Plus,
  ShoppingCart,
  Truck,
  User,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const QuickActionsButton = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button data-quick-actions-trigger="true" variant="outline" size="sm" className="gap-2">
          <Menu className="h-4 w-4" />
          <span>Швидкі дії</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <Link href="/shifts/new" className="w-full">
          <DropdownMenuItem className="cursor-pointer">
            <Plus className="h-4 w-4 mr-2" />
            <span>Створити нову зміну</span>
          </DropdownMenuItem>
        </Link>
        <Link href="/employees" className="w-full">
          <DropdownMenuItem className="cursor-pointer">
            <Users className="h-4 w-4 mr-2" />
            <span>Керувати працівниками</span>
          </DropdownMenuItem>
        </Link>
        <Link href="/products" className="w-full">
          <DropdownMenuItem className="cursor-pointer">
            <Package className="h-4 w-4 mr-2" />
            <span>Керувати продукцією</span>
          </DropdownMenuItem>
        </Link>
        <Link href="/materials" className="w-full">
          <DropdownMenuItem className="cursor-pointer">
            <Box className="h-4 w-4 mr-2" />
            <span>Керувати матеріалами</span>
          </DropdownMenuItem>
        </Link>
        <Link href="/inventory" className="w-full">
          <DropdownMenuItem className="cursor-pointer">
            <Boxes className="h-4 w-4 mr-2" />
            <span>Управління складом</span>
          </DropdownMenuItem>
        </Link>
        <Link href="/shipments" className="w-full">
          <DropdownMenuItem className="cursor-pointer">
            <CalendarDays className="h-4 w-4 mr-2" />
            <span>Відвантаження</span>
          </DropdownMenuItem>
        </Link>
        <Link href="/tasks" className="w-full">
          <DropdownMenuItem className="cursor-pointer">
            <CheckSquare className="h-4 w-4 mr-2" />
            <span>Задачі</span>
          </DropdownMenuItem>
        </Link>
        <Link href="/statistics" className="w-full">
          <DropdownMenuItem className="cursor-pointer">
            <PieChart className="h-4 w-4 mr-2" />
            <span>Статистика виробництва</span>
          </DropdownMenuItem>
        </Link>
        <Link href="/expenses" className="w-full">
          <DropdownMenuItem className="cursor-pointer">
            <DollarSign className="h-4 w-4 mr-2" />
            <span>Облік витрат</span>
          </DropdownMenuItem>
        </Link>
        <Link href="/suppliers" className="w-full">
          <DropdownMenuItem className="cursor-pointer">
            <Truck className="h-4 w-4 mr-2" />
            <span>Постачальники</span>
          </DropdownMenuItem>
        </Link>
        <Link href="/vehicles" className="w-full">
          <DropdownMenuItem className="cursor-pointer">
            <Car className="h-4 w-4 mr-2" />
            <span>Транспорт</span>
          </DropdownMenuItem>
        </Link>
        <Link href="/trips" className="w-full">
          <DropdownMenuItem className="cursor-pointer">
            <MapPin className="h-4 w-4 mr-2" />
            <span>Поїздки</span>
          </DropdownMenuItem>
        </Link>
        <Link href="/transactions/suppliers" className="w-full">
          <DropdownMenuItem className="cursor-pointer">
            <ShoppingCart className="h-4 w-4 mr-2" />
            <span>Закупка</span>
          </DropdownMenuItem>
        </Link>
        <Link href="/user" className="w-full">
          <DropdownMenuItem className="cursor-pointer">
            <User className="h-4 w-4 mr-2" />
            <span>Мій профіль</span>
          </DropdownMenuItem>
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
