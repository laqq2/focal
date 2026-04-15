export interface WeatherState {
  label: string;
  tempC: number;
  icon: string;
  /** Plain-language condition for UI that avoids emoji. */
  conditionText?: string;
}

/** Short text for sidebar (no emoji), WMO 0–99. */
export function wmoToConditionText(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Fog or haze";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  if (code <= 99) return "Thunderstorm";
  return "Variable";
}

function wmoToEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 48) return "🌫️";
  if (code <= 57 || code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌧️";
  if (code <= 86) return "❄️";
  if (code <= 99) return "⛈️";
  return "⛅";
}

export async function fetchMelbourneWeather(): Promise<WeatherState> {
  const lat = -37.8136;
  const lon = 144.9631;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather request failed");
  const json = (await res.json()) as {
    current_weather?: { temperature: number; weathercode: number };
  };
  const cw = json.current_weather;
  if (!cw) throw new Error("No current weather");
  return {
    label: "Melbourne",
    tempC: Math.round(cw.temperature),
    icon: wmoToEmoji(cw.weathercode),
    conditionText: wmoToConditionText(cw.weathercode),
  };
}

export async function fetchWeatherByCoords(lat: number, lon: number, label: string): Promise<WeatherState> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather request failed");
  const json = (await res.json()) as {
    current_weather?: { temperature: number; weathercode: number };
  };
  const cw = json.current_weather;
  if (!cw) throw new Error("No current weather");
  return {
    label,
    tempC: Math.round(cw.temperature),
    icon: wmoToEmoji(cw.weathercode),
    conditionText: wmoToConditionText(cw.weathercode),
  };
}
