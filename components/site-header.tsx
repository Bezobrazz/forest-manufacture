"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Box,
  Building2,
  CalendarDays,
  Car,
  CheckSquare,
  ChevronDown,
  DollarSign,
  Home,
  MapPin,
  MoreHorizontal,
  Package,
  ShoppingCart,
  Truck,
  User,
  Users,
  Warehouse,
} from "lucide-react";

import {
  FOOTER_NAV_SECTIONS,
  type FooterNavGroup,
} from "@/lib/navigation/footer-nav";
import { cn } from "@/lib/utils";

const PRIMARY_LABELS = [
  "Зміни",
  "Склад",
  "Відвантаження",
  "Витрати",
  "Закупка",
  "Поїздки",
  "Статистика",
] as const;

const MORE_LABELS = [
  "Працівники",
  "Продукція",
  "Матеріали",
  "Задачі",
  "Постачальники",
  "Транспорт",
  "Профіль",
] as const;

const NAV_ICONS: Record<string, LucideIcon> = {
  Головна: Home,
  Зміни: CalendarDays,
  Склад: Warehouse,
  Відвантаження: Truck,
  Витрати: DollarSign,
  Закупка: ShoppingCart,
  Поїздки: MapPin,
  Статистика: BarChart3,
  Ще: MoreHorizontal,
  Працівники: Users,
  Продукція: Package,
  Матеріали: Box,
  Задачі: CheckSquare,
  Постачальники: Building2,
  Транспорт: Car,
  Профіль: User,
};

const ALL_GROUPS: FooterNavGroup[] = FOOTER_NAV_SECTIONS.flatMap(
  (section) => section.groups
);

function findGroup(label: string): FooterNavGroup | undefined {
  return ALL_GROUPS.find((group) => group.label === label);
}

function pathOnly(href: string) {
  return href.split("?")[0];
}

function isGroupActive(pathname: string, href?: string) {
  if (!href) return false;
  const base = pathOnly(href);
  if (base === "/") return pathname === "/";
  return pathname === base || pathname.startsWith(`${base}/`);
}

function NavIcon({ label, className }: { label: string; className?: string }) {
  const Icon = NAV_ICONS[label];
  if (!Icon) return null;
  return <Icon className={cn("h-4 w-4 shrink-0 opacity-70", className)} aria-hidden />;
}

const triggerClassName =
  "inline-flex h-10 items-center gap-1.5 px-3 text-sm font-medium whitespace-nowrap transition-colors hover:bg-accent hover:text-accent-foreground";

const dropdownPanelClassName =
  "rounded-md border bg-popover p-1 text-popover-foreground shadow-md";

const dropdownLinkClassName =
  "flex items-center gap-2 rounded-sm px-3 py-2 text-sm whitespace-nowrap hover:bg-accent hover:text-accent-foreground";

function TabDropdown({
  group,
  pathname,
}: {
  group: FooterNavGroup;
  pathname: string;
}) {
  const active = isGroupActive(pathname, group.href);
  const items = group.items ?? [];

  if (items.length === 0) {
    if (!group.href) return null;
    return (
      <Link
        href={group.href}
        className={cn(triggerClassName, active && "bg-accent/70 text-accent-foreground")}
      >
        <NavIcon label={group.label} />
        {group.label}
      </Link>
    );
  }

  return (
    <div className="group relative">
      <Link
        href={group.href ?? items[0].href}
        className={cn(triggerClassName, active && "bg-accent/70 text-accent-foreground")}
      >
        <NavIcon label={group.label} />
        {group.label}
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 opacity-50 transition duration-200 group-hover:rotate-180 group-hover:opacity-90"
          aria-hidden
        />
      </Link>

      <div className="pointer-events-none absolute left-0 top-full z-50 min-w-[12rem] pt-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <ul className={dropdownPanelClassName}>
          {items.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={dropdownLinkClassName}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MoreMenu({
  groups,
  pathname,
}: {
  groups: FooterNavGroup[];
  pathname: string;
}) {
  const moreActive = groups.some((group) =>
    isGroupActive(pathname, group.href)
  );

  return (
    <div className="group relative">
      <button
        type="button"
        className={cn(
          triggerClassName,
          moreActive && "bg-accent/70 text-accent-foreground"
        )}
      >
        <NavIcon label="Ще" />
        Ще
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 opacity-50 transition duration-200 group-hover:rotate-180 group-hover:opacity-90"
          aria-hidden
        />
      </button>

      <div className="pointer-events-none absolute right-0 top-full z-50 min-w-[16rem] pt-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <ul className={cn(dropdownPanelClassName, "py-1.5")}>
          {groups.map((group) => {
            const items = group.items ?? [];
            const active = isGroupActive(pathname, group.href);

            return (
              <li key={group.label} className="px-1">
                {group.href ? (
                  <Link
                    href={group.href}
                    className={cn(
                      dropdownLinkClassName,
                      "font-medium",
                      active && "bg-accent/60"
                    )}
                  >
                    <NavIcon label={group.label} />
                    {group.label}
                  </Link>
                ) : (
                  <p className="flex items-center gap-2 px-3 py-2 text-sm font-medium">
                    <NavIcon label={group.label} />
                    {group.label}
                  </p>
                )}

                {items.length > 0 ? (
                  <ul className="mb-1 ml-3 space-y-0.5 border-l pl-2">
                    {items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="block rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname() ?? "/";

  const primaryGroups = PRIMARY_LABELS.map(findGroup).filter(
    (group): group is FooterNavGroup => Boolean(group)
  );
  const moreGroups = MORE_LABELS.map(findGroup).filter(
    (group): group is FooterNavGroup => Boolean(group)
  );

  return (
    <header className="sticky top-0 z-40 hidden w-full border-b bg-background lg:block">
      <div className="flex h-10 w-full items-center gap-1 px-2 xl:px-4">
        <Link
          href="/"
          className={cn(
            triggerClassName,
            "font-semibold",
            pathname === "/" && "bg-accent/50"
          )}
        >
          <NavIcon label="Головна" />
          Головна
        </Link>

        <nav
          aria-label="Основна навігація"
          className="flex min-w-0 flex-1 items-center gap-0.5"
        >
          {primaryGroups.map((group) => (
            <TabDropdown key={group.label} group={group} pathname={pathname} />
          ))}

          <div className="ml-auto">
            <MoreMenu groups={moreGroups} pathname={pathname} />
          </div>
        </nav>
      </div>
    </header>
  );
}
