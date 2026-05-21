"use client";

import Link from "next/link";
import { forwardRef, type CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
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
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type QuickAction = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const QUICK_ACTIONS: QuickAction[] = [
  { href: "/shifts/new", label: "Створити нову зміну", icon: Plus },
  { href: "/employees", label: "Керувати працівниками", icon: Users },
  { href: "/products", label: "Керувати продукцією", icon: Package },
  { href: "/materials", label: "Керувати матеріалами", icon: Box },
  { href: "/inventory", label: "Управління складом", icon: Boxes },
  { href: "/shipments", label: "Відвантаження", icon: CalendarDays },
  { href: "/tasks", label: "Задачі", icon: CheckSquare },
  { href: "/statistics", label: "Статистика виробництва", icon: PieChart },
  { href: "/expenses", label: "Облік витрат", icon: DollarSign },
  { href: "/suppliers", label: "Постачальники", icon: Truck },
  { href: "/vehicles", label: "Транспорт", icon: Car },
  { href: "/trips", label: "Поїздки", icon: MapPin },
  { href: "/transactions/suppliers", label: "Закупка", icon: ShoppingCart },
  { href: "/user", label: "Мій профіль", icon: User },
];

const QuickActionsTriggerButton = forwardRef<
  HTMLButtonElement,
  ButtonProps & { mobile?: boolean }
>(({ mobile, className, ...props }, ref) => (
  <Button
    ref={ref}
    type="button"
    data-quick-actions-trigger="true"
    variant="outline"
    size={mobile ? "default" : "sm"}
    className={cn(
      "gap-2",
      mobile && "min-h-11 px-4 text-base",
      className
    )}
    {...props}
  >
    <Menu className={cn("shrink-0", mobile ? "h-5 w-5" : "h-4 w-4")} />
    <span>Швидкі дії</span>
  </Button>
));
QuickActionsTriggerButton.displayName = "QuickActionsTriggerButton";

function QuickActionLink({
  action,
  className,
  style,
}: {
  action: QuickAction;
  className?: string;
  style?: CSSProperties;
}) {
  const Icon = action.icon;
  return (
    <Link
      href={action.href}
      style={style}
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-lg border border-input px-4 py-3 text-base transition-colors active:bg-accent hover:bg-muted/50",
        className
      )}
    >
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
      <span className="leading-snug">{action.label}</span>
    </Link>
  );
}

function QuickActionsSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <QuickActionsTriggerButton mobile />
      </SheetTrigger>
      <SheetContent
        side="bottom"
        overlayClassName={cn(
          "motion-reduce:animate-none",
          "data-[state=open]:animate-quick-actions-overlay-in",
          "data-[state=closed]:animate-quick-actions-overlay-out"
        )}
        className={cn(
          "max-h-[85vh] rounded-t-xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 transition-none",
          "motion-reduce:animate-none",
          "data-[state=open]:animate-quick-actions-sheet-in",
          "data-[state=closed]:animate-quick-actions-sheet-out",
          "data-[state=open]:[&_.quick-action-item]:animate-quick-actions-item-in"
        )}
      >
        <div
          className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30"
          aria-hidden
        />
        <SheetHeader className="text-left">
          <SheetTitle>Швидкі дії</SheetTitle>
        </SheetHeader>
        <nav className="mt-4 flex max-h-[calc(85vh-5rem)] flex-col gap-2 overflow-y-auto overscroll-contain">
          {QUICK_ACTIONS.map((action, index) => (
            <SheetClose key={action.href} asChild>
              <QuickActionLink
                action={action}
                className="quick-action-item motion-reduce:animate-none"
                style={{
                  animationDelay: `${80 + index * 24}ms`,
                }}
              />
            </SheetClose>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function QuickActionsDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <QuickActionsTriggerButton />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem key={action.href} asChild>
              <Link
                href={action.href}
                className="flex min-h-10 cursor-pointer items-center gap-2 py-2.5"
              >
                <Icon className="h-4 w-4" />
                <span>{action.label}</span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const QuickActionsButton = () => {
  return (
    <>
      <div className="md:hidden">
        <QuickActionsSheet />
      </div>
      <div className="hidden md:block">
        <QuickActionsDropdown />
      </div>
    </>
  );
};
