import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), share: vi.fn(), driver: [] as {id:string}[], passenger: [] as {trip_id:string}[] }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ profile: {id:'me', verification_status:'verified'} }) }));
vi.mock('../../lib/supabase', () => ({ supabase: { from: mocks.from } }));
vi.mock('./useLiveLocationSharing', () => ({ useLiveLocationSharing: (...args: unknown[]) => {
  mocks.share(...args);
  return { sharing:true, lastSentAt:'now', permissionDenied:false, noSignal:false, sendError:false };
} }));
import { LiveLocationProvider, useTripLocation } from './LiveLocationProvider';
function View() { const { sharing } = useTripLocation('trip'); return <span>{sharing.sharing ? 'compartiendo' : 'detenido'}</span>; }
async function settle() { await act(async () => { await Promise.resolve(); }); }
describe('seguimiento durante el viaje', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks(); mocks.driver = []; mocks.passenger = [];
    mocks.from.mockImplementation((table: string) => {
      const query = { select: vi.fn(), eq: vi.fn(), neq: vi.fn(), then: (resolve: (v: unknown) => void) => Promise.resolve({data: table === 'trips' ? mocks.driver : mocks.passenger, error:null}).then(resolve) };
      query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.neq.mockReturnValue(query); return query;
    });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  it('activa al pasajero cuando comienza su viaje y detiene el seguimiento al terminar', async () => {
    render(<LiveLocationProvider><View /></LiveLocationProvider>);
    await settle(); expect(screen.getByText('detenido')).toBeTruthy(); expect(mocks.share).not.toHaveBeenCalled();
    mocks.passenger = [{ trip_id:'trip' }];
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(mocks.share).toHaveBeenCalledWith('trip', 'me', 'passenger', true, undefined);
    expect(screen.getByText('compartiendo')).toBeTruthy();
    mocks.passenger = [];
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.getByText('detenido')).toBeTruthy();
  });
  it('mantiene el seguimiento del conductor al cambiar el contenido de la página', async () => {
    mocks.driver = [{id:'trip'}];
    const { rerender } = render(<LiveLocationProvider><View /></LiveLocationProvider>);
    await settle();
    expect(mocks.share).toHaveBeenCalledWith('trip','me','driver',true,undefined);
    rerender(<LiveLocationProvider><p>Perfil</p><View /></LiveLocationProvider>);
    expect(screen.getByText('compartiendo')).toBeTruthy();
  });
});
