import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

interface AudioPlayerProps {
  url: string;
  durationSeconds?: number;
  waveformPeaks?: number[];
}

export function AudioPlayer({ url, durationSeconds = 5, waveformPeaks }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Generate 32 visual peak bars
  const peaks = useRef<number[]>(
    waveformPeaks && waveformPeaks.length >= 20
      ? waveformPeaks.slice(0, 32)
      : Array.from({ length: 32 }, (_, i) => Math.max(0.15, Math.sin(i * 0.4) * 0.7 + 0.3)),
  ).current;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && audio.duration !== Infinity) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.playbackRate = speed;
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 max-w-sm w-full my-1.5 shadow-sm select-none">
      <audio ref={audioRef} src={url} preload="metadata" />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
        title={isPlaying ? 'Pause' : 'Play voice message'}
        className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white flex items-center justify-center shrink-0 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 touch-target"
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
      </button>

      {/* Waveform Visualization */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div
          role="slider"
          aria-label="Audio progress"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          tabIndex={0}
          className="flex items-center gap-0.5 h-6 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 rounded"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickPos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            if (audioRef.current && duration > 0) {
              audioRef.current.currentTime = clickPos * duration;
              setCurrentTime(clickPos * duration);
            }
          }}
        >
          {peaks.map((height, i) => {
            const barPos = i / peaks.length;
            const isPlayed = barPos <= progress;
            return (
              <span
                key={i}
                className={`w-1 rounded-full transition-colors ${
                  isPlayed ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'
                }`}
                style={{ height: `${Math.round(height * 24)}px` }}
              />
            );
          })}
        </div>

        {/* Timestamps */}
        <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Speed Control Pill */}
      <button
        type="button"
        onClick={cycleSpeed}
        aria-label={`Playback speed ${speed}x`}
        className="px-2 py-1 text-[11px] font-bold rounded-md bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition-colors shrink-0 touch-target flex items-center justify-center"
        title="Playback speed"
      >
        {speed}x
      </button>
    </div>
  );
}
