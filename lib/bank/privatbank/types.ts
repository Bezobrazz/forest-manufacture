export type PrivatAccount = {
  iban: string;
  label: string;
};

export type PrivatTransactionType = "C" | "D";

/** Нормалізована банківська операція для UI. */
export type BankTransaction = {
  id: string;
  accountIban: string;
  accountLabel: string;
  /** YYYY-MM-DD */
  date: string;
  /** ISO-подібний рядок дати/часу, якщо є */
  dateTime: string | null;
  amount: number;
  amountUah: number;
  currency: string;
  type: PrivatTransactionType;
  counterpartName: string | null;
  counterpartIban: string | null;
  counterpartEdrpou: string | null;
  purpose: string | null;
  documentNumber: string | null;
  status: string | null;
};

export type PrivatRawTransaction = {
  ID?: string;
  SUM?: string;
  SUM_E?: string;
  CCY?: string;
  TRANTYPE?: string;
  OSND?: string;
  AUT_CNTR_NAM?: string;
  AUT_CNTR_ACC?: string;
  AUT_CNTR_CRF?: string;
  NUM_DOC?: string;
  PR_PR?: string;
  DAT_OD?: string;
  DATE_TIME_DAT_OD_TIM_P?: string;
  TECHNICAL_TRANSACTION_ID?: string;
  REF?: string;
};

export type PrivatApiMeta = {
  status?: string;
  type?: string;
  exist_next_page?: boolean;
  next_page_id?: string;
  message?: string;
  error?: string;
  errMsg?: string;
};

export type PrivatTransactionsResponse = PrivatApiMeta & {
  transactions?: PrivatRawTransaction[];
};

export type PrivatRawBalance = {
  acc?: string;
  currency?: string;
  balanceIn?: string;
  balanceInEq?: string;
  balanceOut?: string;
  balanceOutEq?: string;
  turnoverDebt?: string;
  turnoverCred?: string;
  dpd?: string;
  nameACC?: string;
  state?: string;
  is_final_bal?: boolean;
};

export type PrivatBalancesResponse = PrivatApiMeta & {
  balances?: PrivatRawBalance[];
};

/** Поточний залишок рахунку з API банку. */
export type BankAccountBalance = {
  accountIban: string;
  accountLabel: string;
  currency: string;
  /** Поточний вихідний залишок (balanceOut) */
  balance: number;
  /** Дата операційного дня (YYYY-MM-DD), якщо є */
  asOfDate: string | null;
};
