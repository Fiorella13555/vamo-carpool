import {act,renderHook} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {useWakeLock} from './useWakeLock';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it('solicita otro bloqueo de pantalla tras volver y libera al salir',async()=>{
 vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
 const first=Object.assign(new EventTarget(),{released:false,release:vi.fn().mockResolvedValue(undefined)});
 const second=Object.assign(new EventTarget(),{released:false,release:vi.fn().mockResolvedValue(undefined)});
 const request=vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
 vi.stubGlobal('navigator',{wakeLock:{request}});
 const hook=renderHook(()=>useWakeLock(true));await act(async()=>{});expect(request).toHaveBeenCalledTimes(1);
 vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');first.released=true;act(()=>first.dispatchEvent(new Event('release')));
 vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');await act(async()=>{document.dispatchEvent(new Event('visibilitychange'));});expect(request).toHaveBeenCalledTimes(2);
 hook.unmount();expect(second.release).toHaveBeenCalledTimes(1);
});
