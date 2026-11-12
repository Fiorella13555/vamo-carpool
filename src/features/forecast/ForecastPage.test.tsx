import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import example from '../../../public/forecast-example.json';
const mocks = vi.hoisted(() => ({ url:'', metadata:vi.fn(), forecast:vi.fn(), example:vi.fn() }));
vi.mock('./api', () => ({
  get forecastApiUrl() { return mocks.url; }, fetchMetadata:mocks.metadata,
  fetchForecast:mocks.forecast, fetchExample:mocks.example,
}));
import { ForecastPage } from './ForecastPage';
describe('pronósticos de Vamo', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.url='';
    mocks.example.mockResolvedValue(example);
    mocks.metadata.mockResolvedValue(example.metadata);
    mocks.forecast.mockResolvedValue(example.forecast);
  });
  afterEach(cleanup);
  it('muestra el resultado precalculado como sintético y deshabilita filtros que no puede calcular', async () => {
    render(<MemoryRouter><ForecastPage /></MemoryRouter>);
    expect(await screen.findByText('Ejemplo precalculado')).toBeTruthy();
    expect(screen.getByText('Datos 100% sintéticos')).toBeTruthy();
    expect((screen.getByLabelText('Origen') as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText('Rutas con mayor demanda')).toBeTruthy();
    expect(mocks.forecast).not.toHaveBeenCalled();
  });
  it('consulta el modelo con origen, destino y hora seleccionados', async () => {
    mocks.url='https://modelo.example';
    render(<MemoryRouter><ForecastPage /></MemoryRouter>);
    await screen.findByText('Rutas con mayor demanda');
    fireEvent.change(screen.getByLabelText('Origen'), {target:{value:'san_borja'}});
    fireEvent.change(screen.getByLabelText('Destino'), {target:{value:'jesus_maria'}});
    fireEvent.change(screen.getByLabelText('Horario'), {target:{value:'8'}});
    await waitFor(() => expect(mocks.forecast).toHaveBeenLastCalledWith(
      expect.objectContaining({origin:'san_borja',destination:'jesus_maria',hour:'8'}),expect.any(AbortSignal)));
    expect(mocks.example).not.toHaveBeenCalled();
  });
  it('muestra el error del servicio configurado en lugar de aparentar una predicción actual', async () => {
    mocks.url='https://modelo.example'; mocks.metadata.mockRejectedValue(new Error('offline'));
    render(<MemoryRouter><ForecastPage /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(mocks.example).not.toHaveBeenCalled();
    expect(screen.queryByText('Rutas con mayor demanda')).toBeNull();
  });
});
