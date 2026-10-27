import { useCallback, useEffect, useRef, useState } from 'react';
import behaviorsConfig from '../../config/behaviors.json';
import { BehaviorMonitor, SimClient, type BehaviorState, type ConnectomeInfo } from '../sim';
import type { ActivitySnapshot } from '../sim';

export interface SimFrame {
  activity: ActivitySnapshot;
  realtimeFactor: number;
  behaviors: BehaviorState[];
}

export type LoadState =
  | { status: 'loading'; loadedBytes: number; totalBytes: number }
  | { status: 'ready'; info: ConnectomeInfo }
  | { status: 'error'; message: string };

/** Owns the worker client for the page lifetime. `onFrame` gets every frame without causing a React render. */
export function useSimulation(onFrame: (frame: SimFrame) => void) {
  const clientRef = useRef<SimClient | null>(null);
  const monitorRef = useRef(new BehaviorMonitor(behaviorsConfig.behaviors));
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const [load, setLoad] = useState<LoadState>({ status: 'loading', loadedBytes: 0, totalBytes: 0 });
  const [speed, setSpeedState] = useState(1);

  useEffect(() => {
    const client = new SimClient();
    clientRef.current = client;
    const offProgress = client.on('progress', (loadedBytes, totalBytes) =>
      setLoad({ status: 'loading', loadedBytes, totalBytes }),
    );
    const offFrame = client.on('frame', (f) => {
      const behaviors = monitorRef.current.push(f.activity);
      onFrameRef.current({ activity: f.activity, realtimeFactor: f.realtimeFactor, behaviors });
    });
    const offError = client.on('error', (message) => setLoad({ status: 'error', message }));
    client.ready
      .then((info) => {
        setLoad({ status: 'ready', info });
        client.setSpeed(1);
      })
      .catch((err: Error) => setLoad({ status: 'error', message: err.message }));
    return () => {
      offProgress();
      offFrame();
      offError();
      client.dispose();
      clientRef.current = null;
    };
  }, []);

  const setSpeed = useCallback((s: number) => {
    setSpeedState(s);
    clientRef.current?.setSpeed(s);
  }, []);

  const stimulate = useCallback((setId: string, rateHz: number) => clientRef.current?.stimulate(setId, rateHz), []);
  const stepOnce = useCallback((ms: number) => clientRef.current?.stepOnce(ms), []);
  const reset = useCallback(() => {
    monitorRef.current.reset();
    clientRef.current?.reset(1);
  }, []);

  return { load, speed, setSpeed, stimulate, stepOnce, reset };
}
