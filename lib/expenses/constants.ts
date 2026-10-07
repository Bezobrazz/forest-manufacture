/** Категорія витрат для місячних рахунків за електроенергію (розподіл на вироблені мішки). */
export const ELECTRICITY_EXPENSE_CATEGORY_NAME = "Електроенергія";

export const HOURLY_WAGE_CATEGORY_NAME = "З.П. Погодинна";
export const LOADING_COUNT_CATEGORY_NAME = "З/П Підрахунок завантаження";
export const PRODUCT_LOADING_CATEGORY_NAME = "З/П Завантаження кори";

/** Категорії З.П. змін, що входять у собівартість мішка. */
export const COST_SHIFT_WAGE_CATEGORY_NAMES = [
  HOURLY_WAGE_CATEGORY_NAME,
  LOADING_COUNT_CATEGORY_NAME,
  PRODUCT_LOADING_CATEGORY_NAME,
] as const;

export const isCostShiftWageCategory = (name: string) =>
  (COST_SHIFT_WAGE_CATEGORY_NAMES as readonly string[]).includes(name.trim());
