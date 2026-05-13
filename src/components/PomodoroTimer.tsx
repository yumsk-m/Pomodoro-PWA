import { useEffect, useMemo, useRef, useState } from 'react';
import { setWhiteNoiseVolume, startWhiteNoise, stopWhiteNoise } from '../lib/whiteNoise';

type Phase = 'noise' | 'silent' | 'finished';

type Settings = {
  noiseMinutes: number;
  silentMinutes: number;
  totalRounds: number;
  volume: number;
};

const SETTINGS_KEY = 'white-loop-settings-v1';
const DEFAULT_VOLUME = 0.08;
const MAX_VOLUME = 0.35;

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function loadSettings(): Settings {
  if (typeof window === 'undefined') {
    return {
      noiseMinutes: 25,
      silentMinutes: 5,
      totalRounds: 4,
      volume: DEFAULT_VOLUME,
    };
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return {
        noiseMinutes: 25,
        silentMinutes: 5,
        totalRounds: 4,
        volume: DEFAULT_VOLUME,
      };
    }

    const parsed = JSON.parse(raw) as Partial<Settings>;

    return {
      noiseMinutes: clampNumber(Number(parsed.noiseMinutes ?? 25), 1, 180),
      silentMinutes: clampNumber(Number(parsed.silentMinutes ?? 5), 1, 60),
      totalRounds: clampNumber(Number(parsed.totalRounds ?? 4), 1, 20),
      volume: clampNumber(Number(parsed.volume ?? DEFAULT_VOLUME), 0, MAX_VOLUME),
    };
  } catch {
    return {
      noiseMinutes: 25,
      silentMinutes: 5,
      totalRounds: 4,
      volume: DEFAULT_VOLUME,
    };
  }
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function PomodoroTimer() {
  const initial = loadSettings();
  const [noiseMinutes, setNoiseMinutes] = useState(initial.noiseMinutes);
  const [silentMinutes, setSilentMinutes] = useState(initial.silentMinutes);
  const [totalRounds, setTotalRounds] = useState(initial.totalRounds);
  const [volume, setVolume] = useState(initial.volume);

  const [phase, setPhase] = useState<Phase>('noise');
  const [currentRound, setCurrentRound] = useState(1);
  const [remainingSeconds, setRemainingSeconds] = useState(initial.noiseMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const intervalRef = useRef<number | null>(null);
  const phaseEndAtRef = useRef<number | null>(null);

  const phaseLabel = useMemo(() => {
    if (phase === 'noise') return 'ホワイトノイズ中';
    if (phase === 'silent') return '無音休憩中';
    return '完了';
  }, [phase]);

  useEffect(() => {
    const settings: Settings = {
      noiseMinutes,
      silentMinutes,
      totalRounds,
      volume,
    };
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [noiseMinutes, silentMinutes, totalRounds, volume]);

  useEffect(() => {
    if (isRunning && phase === 'noise') {
      setWhiteNoiseVolume(volume);
    }
  }, [isRunning, phase, volume]);

  useEffect(() => {
    if (isRunning || hasStarted) return;

    if (phase === 'noise') {
      setRemainingSeconds(noiseMinutes * 60);
    }

    if (phase === 'silent') {
      setRemainingSeconds(silentMinutes * 60);
    }
  }, [noiseMinutes, silentMinutes, isRunning, hasStarted, phase]);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const tick = () => {
      const endAt = phaseEndAtRef.current;
      if (!endAt) return;

      const nextRemaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRemainingSeconds(nextRemaining);

      if (nextRemaining > 0) return;

      if (phase === 'noise') {
        stopWhiteNoise();
        // 最終ラウンドは休憩をスキップして終了
        if (currentRound >= totalRounds) {
          setPhase('finished');
          setIsRunning(false);
          phaseEndAtRef.current = null;
          setRemainingSeconds(0);
          return;
        }
        setPhase('silent');
        setRemainingSeconds(silentMinutes * 60);
        phaseEndAtRef.current = Date.now() + silentMinutes * 60 * 1000;
        return;
      }

      if (phase === 'silent') {
        if (currentRound >= totalRounds) {
          setPhase('finished');
          setIsRunning(false);
          phaseEndAtRef.current = null;
          setRemainingSeconds(0);
          stopWhiteNoise();
          return;
        }

        const nextRound = currentRound + 1;
        setCurrentRound(nextRound);
        setPhase('noise');
        setRemainingSeconds(noiseMinutes * 60);
        phaseEndAtRef.current = Date.now() + noiseMinutes * 60 * 1000;
        startWhiteNoise(volume);
      }
    };

    intervalRef.current = window.setInterval(tick, 250);
    tick();

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, phase, currentRound, totalRounds, noiseMinutes, silentMinutes, volume]);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
      stopWhiteNoise();
    };
  }, []);

  const start = () => {
    if (phase === 'finished' || isRunning) return;

    phaseEndAtRef.current = Date.now() + remainingSeconds * 1000;
    setHasStarted(true);

    if (phase === 'noise') {
      startWhiteNoise(volume);
    }

    setIsRunning(true);
  };

  const pause = () => {
    if (!isRunning) return;

    setIsRunning(false);
    stopWhiteNoise();

    const endAt = phaseEndAtRef.current;
    if (endAt) {
      setRemainingSeconds(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    }
    phaseEndAtRef.current = null;
  };

  const reset = () => {
    setIsRunning(false);
    setHasStarted(false);
    setPhase('noise');
    setCurrentRound(1);
    setRemainingSeconds(noiseMinutes * 60);
    phaseEndAtRef.current = null;
    stopWhiteNoise();
  };

  return (
    <section className="timer-shell" aria-live="polite">
      <div className="timer-status-card">
        <p className="eyebrow">Current Session</p>
        <h2>{phaseLabel}</h2>
        <p className="countdown">{formatTime(remainingSeconds)}</p>
        <p className="round">
          Round {Math.min(currentRound, totalRounds)} / {totalRounds}
        </p>
      </div>

      <div className="controls-grid">
        <label>
          ホワイトノイズ時間（分）
          <input
            type="number"
            min={1}
            max={180}
            value={noiseMinutes}
            disabled={isRunning}
            onChange={(event) =>
              setNoiseMinutes(clampNumber(Number(event.target.value || 1), 1, 180))
            }
          />
        </label>

        <label>
          無音時間（分）
          <input
            type="number"
            min={1}
            max={60}
            value={silentMinutes}
            disabled={isRunning}
            onChange={(event) =>
              setSilentMinutes(clampNumber(Number(event.target.value || 1), 1, 60))
            }
          />
        </label>

        <label>
          繰り返し回数
          <input
            type="number"
            min={1}
            max={20}
            value={totalRounds}
            disabled={isRunning}
            onChange={(event) =>
              setTotalRounds(clampNumber(Number(event.target.value || 1), 1, 20))
            }
          />
        </label>

        <label>
          音量
          <input
            type="range"
            min={0}
            max={MAX_VOLUME}
            step={0.01}
            value={volume}
            onChange={(event) =>
              setVolume(clampNumber(Number(event.target.value), 0, MAX_VOLUME))
            }
          />
        </label>
      </div>

      <div className="button-row">
        <button
          type="button"
          onClick={isRunning ? pause : start}
          disabled={phase === 'finished'}
        >
          {isRunning ? '一時停止' : hasStarted ? '再開' : '開始'}
        </button>
        <button type="button" onClick={reset}>
          リセット
        </button>
      </div>
    </section>
  );
}
