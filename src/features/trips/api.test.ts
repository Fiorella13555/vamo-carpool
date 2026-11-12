import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ insert: vi.fn(), from: vi.fn(), rpc:vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { from: mocks.from, rpc:mocks.rpc } }));
import { requestPickup, fetchNearbyTrips } from './api';
describe('solicitudes de Vamo', () => {
 beforeEach(() => { vi.clearAllMocks(); mocks.from.mockReturnValue({insert: mocks.insert}); });
 it('envía la solicitud pendiente sin confirmar automáticamente el asiento', async () => {
  mocks.insert.mockResolvedValue({error:null});
  await requestPickup({tripId:'trip',passengerId:'passenger',pickupPoint:{lat:-12.1,lng:-77.03}});
  expect(mocks.from).toHaveBeenCalledWith('pickup_requests');
  expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({trip_id:'trip',passenger_id:'passenger',status:'pending'}));
 });
 it('propaga el rechazo de la base de datos en lugar de simular una solicitud exitosa', async () => {
  const error = new Error('El viaje ya no tiene asientos'); mocks.insert.mockResolvedValue({error});
  await expect(requestPickup({tripId:'trip',passengerId:'passenger',pickupPoint:{lat:-12.1,lng:-77.03}})).rejects.toBe(error);
 });
});

it('guarda el punto de llegada junto al recojo sin aceptar la solicitud', async () => {
 mocks.insert.mockResolvedValue({error:null});
 await requestPickup({tripId:'t',passengerId:'p',pickupPoint:{lat:-12.1,lng:-77.03},dropoffPoint:{lat:-12.08,lng:-77.05}});
 expect(mocks.insert).toHaveBeenLastCalledWith(expect.objectContaining({dropoff_point:'SRID=4326;POINT(-77.05 -12.08)',status:'pending'}));
});

it('busca por ambos extremos, no únicamente el punto de recojo', async () => {
 mocks.rpc.mockResolvedValue({data:[],error:null});
 await fetchNearbyTrips({lat:-12.1,lng:-77.03},150,{lat:-12.08,lng:-77.05});
 expect(mocks.rpc).toHaveBeenLastCalledWith('nearby_journeys', {passenger_lat:-12.1,passenger_lng:-77.03,destination_lat:-12.08,destination_lng:-77.05,tolerance_m:150});
});
