import { fetchNbuEurRate } from "@/lib/exchange/nbu-rates";

export async function GET() {
  try {
    const eur = await fetchNbuEurRate();

    return Response.json(
      {
        ok: true,
        eur: {
          rate: eur.rate,
          exchangeDate: eur.exchangeDate,
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
