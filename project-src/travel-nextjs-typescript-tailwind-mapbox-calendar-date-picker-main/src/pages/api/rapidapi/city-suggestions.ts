import type { NextApiRequest, NextApiResponse } from "next";
import { getExternalApiEnv } from "../../../lib/env";
import type { ISuggestion } from "../../../types/typings";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

  if (query.length < 3) {
    return res.status(400).json({ error: "Query must have at least 3 characters" });
  }

  const { rapidApiKey } = getExternalApiEnv();

  const response = await fetch(
    `https://hotels4.p.rapidapi.com/locations/v3/search?q=${encodeURIComponent(
      query
    )}&locale=en_CA`,
    {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": rapidApiKey,
        "X-RapidAPI-Host": "hotels4.p.rapidapi.com",
      },
    }
  );

  if (!response.ok) {
    return res.status(response.status).json({ error: "RapidAPI request failed" });
  }

  const json = await response.json();
  const suggestions = Array.isArray(json.sr)
    ? json.sr.map((suggestion: ISuggestion) => ({
        shortName: suggestion.regionNames.shortName,
        displayName: suggestion.regionNames.displayName,
        id: suggestion.gaiaId,
        type: suggestion.type,
      }))
    : [];

  return res.status(200).json({ suggestions });
};

export default handler;
