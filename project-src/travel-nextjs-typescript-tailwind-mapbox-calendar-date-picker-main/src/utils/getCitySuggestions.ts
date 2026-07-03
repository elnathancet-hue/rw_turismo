import type { ISuggestionFormatted } from "../types/typings";

const getCitySuggestions = async (word: string, setData: any) => {
  const response = await fetch(
    `/api/rapidapi/city-suggestions?q=${encodeURIComponent(word)}`
  );

  if (!response.ok) {
    setData([]);
    return;
  }

  const json = (await response.json()) as {
    suggestions?: ISuggestionFormatted[];
  };

  setData(json.suggestions ?? []);
};

export default getCitySuggestions;
