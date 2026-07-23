export type FooterNavLink = {
  href: string;
  label: string;
};

export type FooterNavGroup = {
  label: string;
  /** Базовий шлях сторінки; з items — посилання в заголовку групи */
  href?: string;
  /** Вкладки / підрозділи сторінки */
  items?: FooterNavLink[];
};

export type FooterNavSection = {
  title: string;
  groups: FooterNavGroup[];
};

export const FOOTER_NAV_SECTIONS: FooterNavSection[] = [
  {
    title: "Швидкі посилання",
    groups: [
      { label: "Зміни", href: "/shifts" },
      {
        label: "Працівники",
        href: "/employees",
        items: [
          { href: "/employees?tab=workers", label: "Працівники" },
          { href: "/employees?tab=managers", label: "Керівники" },
        ],
      },
      {
        label: "Продукція",
        href: "/products",
        items: [
          { href: "/products?tab=products", label: "Продукція" },
          { href: "/products?tab=categories", label: "Категорії" },
        ],
      },
      {
        label: "Матеріали",
        href: "/materials",
        items: [
          { href: "/materials?tab=materials", label: "Матеріали" },
          { href: "/materials?tab=categories", label: "Категорії" },
        ],
      },
    ],
  },
  {
    title: "Управління",
    groups: [
      {
        label: "Склад",
        href: "/inventory",
        items: [
          { href: "/inventory?tab=finished", label: "Готова продукція" },
          { href: "/inventory?tab=materials", label: "Виробничі матеріали" },
        ],
      },
      {
        label: "Відвантаження",
        href: "/shipments",
        items: [
          { href: "/shipments?tab=month", label: "Місяць" },
          { href: "/shipments?tab=week", label: "Тиждень" },
          { href: "/shipments?tab=list", label: "Черга" },
        ],
      },
      { label: "Задачі", href: "/tasks" },
      {
        label: "Витрати",
        href: "/expenses",
        items: [
          { href: "/expenses?tab=expenses", label: "Витрати" },
          { href: "/expenses?tab=transfers", label: "Переміщення коштів" },
          { href: "/expenses?tab=debts", label: "Борги" },
        ],
      },
      { label: "Постачальники", href: "/suppliers" },
      { label: "Транспорт", href: "/vehicles" },
      {
        label: "Поїздки",
        href: "/trips",
        items: [
          { href: "/trips?tab=commerce", label: "Комерція" },
          { href: "/trips?tab=raw", label: "Сировина" },
        ],
      },
      {
        label: "Закупка",
        href: "/transactions/suppliers",
        items: [
          {
            href: "/transactions/suppliers?tab=transactions",
            label: "Транзакції",
          },
          {
            href: "/transactions/suppliers?tab=packing-bags",
            label: "Мішки (кора)",
          },
        ],
      },
    ],
  },
  {
    title: "Аналітика",
    groups: [
      {
        label: "Статистика",
        href: "/statistics",
        items: [
          { href: "/statistics?tab=cost", label: "Собівартість" },
          { href: "/statistics", label: "Виробництво" },
          { href: "/statistics?tab=ai", label: "ШІ аналіз" },
        ],
      },
    ],
  },
];
