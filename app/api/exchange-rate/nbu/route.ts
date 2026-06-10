import { fetchNbuUsdEurRates } from "@/lib/exchange/nbu-rates";

export async function GET() {
  try {
    const rates = await fetchNbuUsdEurRates();

    return Response.json(
      {
        ok: true,
        usd: {
          rate: rates.usd.rate,
          exchangeDate: rates.usd.exchangeDate,
        },
        eur: {
          rate: rates.eur.rate,
          exchangeDate: rates.eur.exchangeDate,
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
      error instanceof Error ? error.message : "Failed to fetch NBU exchange rates";

    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
