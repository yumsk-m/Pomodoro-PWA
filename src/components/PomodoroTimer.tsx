import { useEffect, useRef, useState } from 'react';
import { setWhiteNoiseVolume, startWhiteNoise, stopWhiteNoise } from '../lib/whiteNoise';

type SessionPhase = 'noise' | 'silent';
type TimerStatus = 'idle' | 'running' | 'paused';
type ActiveStatus = Exclude<TimerStatus, 'idle'>;

type TimerState =
  | { status: 'idle'; phase: 'noise' }
  | { status: ActiveStatus; phase: SessionPhase };

type TimerViewModel = {
  title: string;
  description: string;
};

type Settings = {
  noiseMinutes: number;
  silentMinutes: number;
  totalRounds: number;
  volume: number;
};

const SETTINGS_KEY = 'white-loop-settings-v1';
const DEFAULT_VOLUME = 0.08;
const MAX_VOLUME = 0.35;
const MAX_MINUTES = 180;
const MIN_MINUTES = 1;
const SAVE_DEBOUNCE_MS = 300;
const defaultSettings: Settings = {
  noiseMinutes: 25,
  silentMinutes: 5,
  totalRounds: 4,
  volume: DEFAULT_VOLUME,
};

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, n));
}

function normalizeSettings(settings: Partial<Settings>): Settings {
  return {
    noiseMinutes: clamp(settings.noiseMinutes, MIN_MINUTES, MAX_MINUTES, defaultSettings.noiseMinutes),
    silentMinutes: clamp(settings.silentMinutes, MIN_MINUTES, MAX_MINUTES, defaultSettings.silentMinutes),
    totalRounds: clamp(settings.totalRounds, 1, 99, defaultSettings.totalRounds),
    volume: clamp(settings.volume, 0, MAX_VOLUME, defaultSettings.volume),
  };
}

function loadSettings(): Settings {
  if (typeof window === 'undefined') {
    return defaultSettings;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return defaultSettings;
    }

    const parsed = JSON.parse(raw) as Partial<Settings>;

    return normalizeSettings(parsed);
  } catch {
    return defaultSettings;
  }
}

function saveSettings(settings: Settings): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getTimerViewModel(state: TimerState): TimerViewModel {
  switch (state.status) {
    case 'idle':
      return {
        title: '待機中',
        description: '作業セッションを開始できます。',
      };

    case 'paused':
      return {
        title: '一時停止中',
        description:
          state.phase === 'noise'
            ? '作業セッションを一時停止しています。'
            : '休憩セッションを一時停止しています。',
      };

    case 'running':
      return state.phase === 'noise'
        ? {
            title: '作業中',
            description: '作業セッション中です。',
          }
        : {
            title: '休憩中',
            description: '休憩セッション中です。',
          };
  }
}

export default function PomodoroTimer() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  const [timerState, setTimerState] = useState<TimerState>({
    phase: 'noise',
    status: 'idle',
  });
  const [currentRound, setCurrentRound] = useState(1);
  const [remainingSeconds, setRemainingSeconds] = useState(() => settings.noiseMinutes * 60);

  const intervalRef = useRef<number | null>(null);
  const phaseEndAtRef = useRef<number | null>(null);

  const isRunning = timerState.status === 'running';
  const isSessionActive = timerState.status !== 'idle';
  const timerView = getTimerViewModel(timerState);

  function completeTimer() {
    setTimerState({
      phase: 'noise',
      status: 'idle',
    });
    setCurrentRound(1);
    phaseEndAtRef.current = null;
    setRemainingSeconds(settings.noiseMinutes * 60);
    stopWhiteNoise();
  }

  function switchToSilentPhase() {
    setTimerState({
      phase: 'silent',
      status: 'running',
    });
    setRemainingSeconds(settings.silentMinutes * 60);
    phaseEndAtRef.current = Date.now() + settings.silentMinutes * 60 * 1000;
  }

  function switchToNoisePhase(nextRound: number) {
    setCurrentRound(nextRound);
    setTimerState({
      phase: 'noise',
      status: 'running',
    });
    setRemainingSeconds(settings.noiseMinutes * 60);
    phaseEndAtRef.current = Date.now() + settings.noiseMinutes * 60 * 1000;
    startWhiteNoise(settings.volume);
  }

  function updateSettings(patch: Partial<Settings>) {
    setSettings((prev) => normalizeSettings({
      ...prev,
      ...patch,
    }));
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      saveSettings(settings);
    }, SAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [settings]);

  useEffect(() => {
    if (isRunning && timerState.phase === 'noise') {
      setWhiteNoiseVolume(settings.volume);
    }
  }, [isRunning, timerState.phase, settings.volume]);

  useEffect(() => {
    if (timerState.status !== 'idle') return;

    setRemainingSeconds(settings.noiseMinutes * 60);
  }, [settings.noiseMinutes, timerState.status]);

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

      if (timerState.phase === 'noise') {
        stopWhiteNoise();
        // 最終ラウンドは休憩をスキップして終了
        if (currentRound >= settings.totalRounds) {
          completeTimer();
          return;
        }
        switchToSilentPhase();
        return;
      }

      if (timerState.phase === 'silent') {
        if (currentRound >= settings.totalRounds) {
          completeTimer();
          return;
        }

        const nextRound = currentRound + 1;
        switchToNoisePhase(nextRound);
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
  }, [isRunning, timerState.phase, currentRound, settings]);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
      stopWhiteNoise();
    };
  }, []);

  const handleStart = () => {
    if (isRunning) return;

    if (timerState.status === 'idle') {
      const nextRemaining = settings.noiseMinutes * 60;
      setTimerState({
        phase: 'noise',
        status: 'running',
      });
      setRemainingSeconds(nextRemaining);
      phaseEndAtRef.current = Date.now() + nextRemaining * 1000;
      startWhiteNoise(settings.volume);
      return;
    }

    if (timerState.status === 'paused' && timerState.phase === 'noise') {
      phaseEndAtRef.current = Date.now() + remainingSeconds * 1000;
      setTimerState({
        phase: 'noise',
        status: 'running',
      });
      startWhiteNoise(settings.volume);
      return;
    }

    if (timerState.status === 'paused' && timerState.phase === 'silent') {
      phaseEndAtRef.current = Date.now() + remainingSeconds * 1000;
      setTimerState({
        phase: 'silent',
        status: 'running',
      });
      return;
    }
  };

  const handlePause = () => {
    if (!isRunning) return;

    stopWhiteNoise();

    const endAt = phaseEndAtRef.current;
    if (endAt) {
      setRemainingSeconds(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
    }
    phaseEndAtRef.current = null;

    setTimerState({
      phase: timerState.phase,
      status: 'paused',
    });
  };

  const handleReset = () => {
    setTimerState({
      phase: 'noise',
      status: 'idle',
    });
    setCurrentRound(1);
    setRemainingSeconds(settings.noiseMinutes * 60);
    phaseEndAtRef.current = null;
    stopWhiteNoise();
  };

  return (
    <section className="timer-shell">
      <div className="timer-status-card">
        <p className="eyebrow">Current Session</p>
        <h2>{timerView.title}</h2>
        <p>{timerView.description}</p>
        <p className="countdown">{formatTime(remainingSeconds)}</p>
        <p className="round">
          Round {Math.min(currentRound, settings.totalRounds)} / {settings.totalRounds}
        </p>
      </div>

      <div className="controls-grid">
        <label>
          ホワイトノイズ時間（分）
          <input
            type="number"
            min={1}
            max={180}
            value={settings.noiseMinutes}
            disabled={isSessionActive}
            onChange={(event) =>
              updateSettings({ noiseMinutes: Number(event.target.value) })
            }
          />
        </label>

        <label>
          無音時間（分）
          <input
            type="number"
            min={1}
            max={180}
            value={settings.silentMinutes}
            disabled={isSessionActive}
            onChange={(event) =>
              updateSettings({ silentMinutes: Number(event.target.value) })
            }
          />
        </label>

        <label>
          繰り返し回数
          <input
            type="number"
            min={1}
            max={99}
            value={settings.totalRounds}
            disabled={isSessionActive}
            onChange={(event) =>
              updateSettings({ totalRounds: Number(event.target.value) })
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
            value={settings.volume}
            onChange={(event) =>
              updateSettings({ volume: Number(event.target.value) })
            }
          />
        </label>
      </div>

      <div className="button-row">
        <button
          type="button"
          onClick={isRunning ? handlePause : handleStart}
        >
          {isRunning ? '一時停止' : timerState.status === 'idle' ? '開始' : '再開'}
        </button>
        <button type="button" onClick={handleReset}>
          リセット
        </button>
      </div>
    </section>
  );
}
