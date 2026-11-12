import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn() }));
vi.mock('./api', () => ({ fetchLiveLocations: mocks.fetch, subscribeToLiveLocations: mocks.subscribe }));
import { useLiveLocationViewers } from './useLiveLocationViewers';
const point = { trip_id: 'trip', user_id: 'driver', role: 'driver' as const,
  lat: -12.1, lng: -77.03, accuracy_m: 10,
  recorded_at: '2026-11-03T12:00:00Z', updated_at: '2026-11-03T12:00:00Z' };
async function settle() { await act(async () => { await Promise.resolve(); }); }
describe('ubicaciones autorizadas en vivo', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks();
    mocks.subscribe.mockReturnValue(mocks.unsubscribe);
    mocks.fetch.mockResolvedValue([point]);
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  it('quita coordenadas al finalizar el viaje aunque no llegue un evento DELETE', async () => {
    const { result } = renderHook(() => useLiveLocationViewers('trip'));
    await settle(); expect(result.current.points).toEqual([point]);
    mocks.fetch.mockResolvedValue([]);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(result.current.points).toEqual([]);
  });
  it('vuelve a consultar RLS si un evento llega durante la carga inicial', async () => {
    let resolve!: (value: typeof point[]) => void;
    mocks.fetch.mockReturnValueOnce(new Promise(r => { resolve = r; })).mockResolvedValue([]);
    const { result } = renderHook(() => useLiveLocationViewers('trip'));
    act(() => { mocks.subscribe.mock.calls[0][1](point, 'UPDATE'); });
    await act(async () => { resolve([point]); });
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(result.current.points).toEqual([]);
  });
  it('no conserva posiciones si falla la comprobación de acceso', async () => {
    const { result, unmount } = renderHook(() => useLiveLocationViewers('trip'));
    await settle();
    mocks.fetch.mockRejectedValue(new Error('Access revoked'));
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(result.current.points).toEqual([]);
    unmount(); expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });
});
