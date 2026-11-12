export interface ForecastMetadata {
  data_source: 'synthetic'; rows: number; algorithm: string;
  forecast_start: string; forecast_end: string; timezone: string;
  districts: { id: string; name: string; lat: number; lng: number }[];
  splits: Record<'train' | 'validation' | 'test', {start: string; end: string; rows: number}>;
  evaluation: { test: Record<'demand' | 'traffic', {
    model: {mae: number; rmse: number}; seasonal_baseline: {mae: number; rmse: number};
  }> };
}
export interface Forecast {
  data_source: 'synthetic'; day: string; selected_hour: number | null;
  total_expected_requests: number; peak_demand_hour: number; peak_traffic_hour: number;
  hourly: {hour: number; expected_requests: number; traffic_factor: number}[];
  routes: {origin: string; destination: string; origin_name: string; destination_name: string;
    expected_requests: number; peak_hour: number; traffic_peak_hour: number;
    travel_minutes: number; traffic_factor: number; congestion: string}[];
  origins: {id: string; name: string; expected_requests: number}[];
  destinations: {id: string; name: string; expected_requests: number}[];
}
export const forecastApiUrl = import.meta.env.VITE_RECOMMENDATION_API_URL?.replace(/\/$/, '');
async function get<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {signal});
  if (!response.ok) {
    if (response.status === 422) throw new Error('Revisa la fecha y selecciona un origen y destino diferentes.');
    throw new Error('Los pronósticos no están disponibles en este momento.');
  }
  return response.json() as Promise<T>;
}
export function fetchMetadata(signal: AbortSignal) {
  return get<ForecastMetadata>(`${forecastApiUrl}/forecast/metadata`, signal);
}
export function fetchExample(signal: AbortSignal) {
  return get<{metadata: ForecastMetadata; forecast: Forecast}>('/forecast-example.json', signal);
}
export function fetchForecast(filters: {day: string; origin: string; destination: string; hour: string}, signal: AbortSignal) {
  const query = new URLSearchParams({day: filters.day});
  if (filters.origin) query.set('origin', filters.origin);
  if (filters.destination) query.set('destination', filters.destination);
  if (filters.hour !== '') query.set('hour', filters.hour);
  return get<Forecast>(`${forecastApiUrl}/forecast?${query}`, signal);
}
