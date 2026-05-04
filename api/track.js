// api/track.js — Roadora Tracking v2 for Vercel
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const event = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

    const safeEvent = {
      event: String(event.event || "unknown").slice(0, 80),
      data: event.data || {},
      ts: event.ts || new Date().toISOString(),
      appVersion: event.appVersion || "unknown",
      page: event.page || "",
      referrer: event.referrer || "",
      route: event.route || {},
      ip: req.headers["x-forwarded-for"] || "",
      userAgent: req.headers["user-agent"] || ""
    };

    console.log("ROADORA_TRACKING_EVENT", JSON.stringify(safeEvent));

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("ROADORA_TRACKING_ERROR", error);
    return res.status(500).json({ ok: false, error: "Tracking failed" });
  }
}
