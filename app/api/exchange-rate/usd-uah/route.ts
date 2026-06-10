import { fetchNbuUsdUahRate } from "@/lib/exchange/usd-uah";

export async function GET() {
  try {
    const snapshot = await fetchNbuUsdUahRate();

    return Response.json(
      {
        ok: true,
        rate: snapshot.rate,
        exchangeDate: snapshot.exchangeDate,
        source: snapshot.source,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch USD/UAH rate";

    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
