'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Radio, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Clock, Calendar, Loader2 } from 'lucide-react';

interface RadioBroadcast {
  id: string;
  title: string;
  description: string | null;
  audio_url: string;
  duration: number | null;
  date: string;
  category: string;
  created_at: string;
}

export function RadioClient({ initialBroadcasts }: { initialBroadcasts: RadioBroadcast[] }) {
  const [broadcasts, setBroadcasts] = useState<RadioBroadcast[]>(initialBroadcasts);
  const [needsFetch, setNeedsFetch] = useState(initialBroadcasts.length === 0);

  // 播放器状态
  const [currentBroadcast, setCurrentBroadcast] = useState<RadioBroadcast | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  // 获取广播列表
  useEffect(() => {
    if (!needsFetch) return;
    fetch('/api/radio')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setBroadcasts(data);
          setNeedsFetch(false);
        }
      })
      .catch(() => {});
  }, [needsFetch]);

  // 初始化音频
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;

      audioRef.current.addEventListener('timeupdate', () => {
        setCurrentTime(audioRef.current?.currentTime || 0);
      });

      audioRef.current.addEventListener('loadedmetadata', () => {
        setDuration(audioRef.current?.duration || 0);
      });

      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
        handleNext();
      });

      audioRef.current.addEventListener('play', () => setIsPlaying(true));
      audioRef.current.addEventListener('pause', () => setIsPlaying(false));
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // 播放/暂停
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  }, [isPlaying]);

  // 选择播放
  const playBroadcast = useCallback((broadcast: RadioBroadcast) => {
    if (!audioRef.current) return;
    
    audioRef.current.pause();
    audioRef.current.src = broadcast.audio_url;
    audioRef.current.playbackRate = playbackRate;
    audioRef.current.play().catch(() => {});
    setCurrentBroadcast(broadcast);
    setCurrentTime(0);
  }, [playbackRate]);

  // 上一首
  const handlePrev = useCallback(() => {
    if (!currentBroadcast) return;
    const idx = broadcasts.findIndex(b => b.id === currentBroadcast.id);
    if (idx > 0) {
      playBroadcast(broadcasts[idx - 1]);
    }
  }, [currentBroadcast, broadcasts, playBroadcast]);

  // 下一首
  const handleNext = useCallback(() => {
    if (!currentBroadcast) return;
    const idx = broadcasts.findIndex(b => b.id === currentBroadcast.id);
    if (idx < broadcasts.length - 1) {
      playBroadcast(broadcasts[idx + 1]);
    }
  }, [currentBroadcast, broadcasts, playBroadcast]);

  // 进度条点击
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = percent * duration;
  };

  // 音量控制
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  // 静音切换
  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.8;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  // 倍速切换
  const cyclePlaybackRate = () => {
    const rates = [1, 1.25, 1.5, 2];
    const currentIdx = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIdx + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const currentIdx = currentBroadcast ? broadcasts.findIndex(b => b.id === currentBroadcast.id) : -1;

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部标题 */}
      <div className="max-w-4xl mx-auto px-4 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Radio className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground">AI 电台</h1>
            <p className="text-sm text-muted-foreground">复古收音机 · AI 资讯语音播报</p>
          </div>
        </div>
      </div>

      {/* 播放器区域 */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-gradient-to-b from-[#2d2820] to-[#1f1b16] rounded-3xl border border-amber-900/20 shadow-2xl shadow-amber-900/10 overflow-hidden">
          {/* 唱片区域 */}
          <div className="flex flex-col items-center py-8 sm:py-12">
            {/* 黑胶唱片 */}
            <div className={`relative w-48 h-48 sm:w-56 sm:h-56 mb-8 ${isPlaying ? 'animate-spin-slow' : ''}`}>
              {/* 外圈 */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 shadow-[inset_0_2px_10px_rgba(255,255,255,0.1)]">
                {/* 纹理 */}
                <div className="absolute inset-2 rounded-full border border-gray-700/30" />
                <div className="absolute inset-4 rounded-full border border-gray-700/20" />
                <div className="absolute inset-6 rounded-full border border-gray-700/10" />
              </div>
              {/* 中心标签 */}
              <div className="absolute inset-[25%] rounded-full bg-gradient-to-br from-amber-800 to-amber-900 flex items-center justify-center shadow-inner">
                <div className="w-4 h-4 rounded-full bg-gray-900 border-2 border-amber-600" />
              </div>
              {/* 播放指示灯 */}
              {isPlaying && (
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 shadow-lg shadow-green-500/50 animate-pulse" />
              )}
            </div>

            {/* 声波动画 */}
            <div className="flex items-end gap-1 h-8 mb-4">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-150 ${
                    isPlaying
                      ? 'bg-gradient-to-t from-amber-500 to-amber-300'
                      : 'bg-amber-700/30'
                  }`}
                  style={{
                    height: isPlaying
                      ? `${20 + Math.sin(Date.now() / 200 + i) * 20 + Math.random() * 20}%`
                      : '20%',
                    animationDelay: `${i * 50}ms`,
                    animation: isPlaying ? `wave ${0.5 + Math.random() * 0.3}s ease-in-out infinite alternate` : 'none',
                  }}
                />
              ))}
            </div>

            {/* 当前播放信息 */}
            <div className="text-center px-4 max-w-md">
              {currentBroadcast ? (
                <>
                  <h2 className="text-lg font-semibold text-amber-100 mb-1 truncate">
                    {currentBroadcast.title}
                  </h2>
                  <p className="text-sm text-amber-400/60 mb-2 line-clamp-1">
                    {currentBroadcast.description}
                  </p>
                  <div className="flex items-center justify-center gap-3 text-xs text-amber-500/50">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(currentBroadcast.date)}
                    </span>
                    {duration > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(duration)}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-amber-500/40">
                  <p className="text-sm">选择一期节目开始收听</p>
                </div>
              )}
            </div>

            {/* 进度条 */}
            {currentBroadcast && (
              <div className="w-full max-w-md px-4 mt-6">
                <div
                  className="h-1.5 bg-amber-900/40 rounded-full cursor-pointer group"
                  onClick={handleProgressClick}
                >
                  <div
                    className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full relative transition-all"
                    style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-amber-300 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="flex justify-between text-xs text-amber-500/50 mt-1.5 px-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            )}

            {/* 控制按钮 */}
            <div className="flex items-center gap-4 mt-6">
              <button
                onClick={handlePrev}
                disabled={currentIdx <= 0}
                className="p-2 text-amber-400/60 hover:text-amber-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <SkipBack className="w-6 h-6" />
              </button>

              <button
                onClick={togglePlay}
                disabled={!currentBroadcast}
                className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100 flex items-center justify-center shadow-lg shadow-amber-900/30 hover:from-amber-500 hover:to-amber-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-amber-600 disabled:hover:to-amber-800"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-1" />
                )}
              </button>

              <button
                onClick={handleNext}
                disabled={currentIdx >= broadcasts.length - 1}
                className="p-2 text-amber-400/60 hover:text-amber-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <SkipForward className="w-6 h-6" />
              </button>
            </div>

            {/* 底部控制 */}
            <div className="flex items-center gap-6 mt-6">
              {/* 音量 */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="text-amber-400/60 hover:text-amber-300 transition-colors"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-amber-900/40 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>

              {/* 倍速 */}
              <button
                onClick={cyclePlaybackRate}
                className="px-3 py-1 text-xs font-medium text-amber-400/60 border border-amber-700/40 rounded-full hover:text-amber-300 hover:border-amber-600/60 transition-colors"
              >
                {playbackRate}x
              </button>
            </div>
          </div>
        </div>

        {/* 播客列表 */}
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <Radio className="w-4 h-4" />
            节目列表
          </h3>
          
          {broadcasts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Radio className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">暂无节目</p>
            </div>
          ) : (
            <div className="space-y-3">
              {broadcasts.map((broadcast, index) => (
                <button
                  key={broadcast.id}
                  onClick={() => playBroadcast(broadcast)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-300 ${
                    currentBroadcast?.id === broadcast.id
                      ? 'bg-primary/5 border-primary/30 shadow-sm'
                      : 'bg-card border-border/30 hover:border-primary/20 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* 播放指示 */}
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      {currentBroadcast?.id === broadcast.id && isPlaying ? (
                        <div className="flex items-end gap-0.5 h-4">
                          {[1, 2, 3].map(i => (
                            <div
                              key={i}
                              className="w-1 bg-primary rounded-full animate-wave"
                              style={{
                                height: `${8 + Math.random() * 8}px`,
                                animationDelay: `${i * 100}ms`,
                              }}
                            />
                          ))}
                        </div>
                      ) : (
                        <Play className="w-4 h-4 text-primary/60" />
                      )}
                    </div>

                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-foreground truncate">
                        {broadcast.title}
                      </h4>
                      {broadcast.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {broadcast.description}
                        </p>
                      )}
                    </div>

                    {/* 元信息 */}
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(broadcast.date)}
                      </div>
                      {broadcast.duration && (
                        <div className="text-xs text-muted-foreground/50 mt-0.5 flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(broadcast.duration)}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 底部留白 */}
      <div className="h-20" />

      {/* CSS动画 */}
      <style jsx>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1); }
        }
        .animate-wave {
          animation: wave 0.5s ease-in-out infinite;
        }
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
