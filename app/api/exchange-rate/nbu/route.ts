import { fetchNbuDebtCurrencyRates } from "@/lib/exchange/nbu-rates";

export async function GET() {
  try {
    const rates = await fetchNbuDebtCurrencyRates();

    return Response.json(
      {
        ok: true,
        usd: {
          rate: rates.USD.rate,
          exchangeDate: rates.USD.exchangeDate,
        },
        eur: {
          rate: rates.EUR.rate,
          exchangeDate: rates.EUR.exchangeDate,
        },
        source: "nbu",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch NBU exchange rate";

    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
