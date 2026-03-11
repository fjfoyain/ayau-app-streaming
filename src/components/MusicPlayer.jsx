import { useState, useEffect, useRef, useMemo } from "react";
import Box from "@mui/material/Box";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import { styled } from "@mui/material/styles";
import PauseRounded from "@mui/icons-material/PauseRounded";
import PlayArrowRounded from "@mui/icons-material/PlayArrowRounded";
import FastForwardRounded from "@mui/icons-material/FastForwardRounded";
import FastRewindRounded from "@mui/icons-material/FastRewindRounded";
import VolumeUpRounded from "@mui/icons-material/VolumeUpRounded";
import VolumeDownRounded from "@mui/icons-material/VolumeDownRounded";
import IconButton from "@mui/material/IconButton";
import { formatTime } from '../utils/musicPlayer';
import { usePlayer } from "../context/PlayerContext";
import { supabase } from '../lib/supabase';
import { recordPlay } from '../services/supabase-api';
import SyncStatusIndicator from './SyncStatusIndicator';

// Pre-set bar heights give each bar its own base height for visual variety
const EQ_HEIGHTS = [40, 70, 55, 85, 60, 45, 75, 50, 90, 38, 72, 48, 65, 42, 80, 55, 44, 68, 50, 62];

// Web Audio singletons — must outlive React component remounts
let _audioCtx = null;
let _analyser = null;
let _dataArray = null;

export default function MusicPlayer() {
  const { state, dispatch } = usePlayer();
  const audio = state.audio;

  const [volume, setVolume] = useState(audio.volume || 0.5);
  const [currentTime, setCurrentTime] = useState(audio.currentTime);
  const [duration, setDuration] = useState(audio.duration || 0);
  const [isBuffering, setIsBuffering] = useState(false);

  // Tracking de reproducción
  const [playbackStartTime, setPlaybackStartTime] = useState(null);
  const [totalSecondsPlayed, setTotalSecondsPlayed] = useState(0);
  const hasRecordedPlay = useRef(false);

  // Near-end transition: track whether we've already triggered the next song
  const transitionedRef = useRef(false);
  const handleNextRef = useRef(null);

  // EQ visualizer: direct DOM refs so RAF loop never causes React re-renders
  const barRefs = useRef([]);
  const isPlayingRef = useRef(state.isPlaying);
  const displayValuesRef = useRef(new Float32Array(EQ_HEIGHTS.length).fill(0.08));

  // Keep isPlayingRef current without stale closures inside RAF
  useEffect(() => {
    isPlayingRef.current = state.isPlaying;
  }, [state.isPlaying]);

  // Web Audio API setup + 60fps RAF visualizer
  useEffect(() => {
    // Create AudioContext singleton
    if (!_audioCtx) {
      // eslint-disable-next-line no-undef
      const Ctx = window.AudioContext || window['webkitAudioContext'];
      _audioCtx = new Ctx();
    }
    // Create analyser + connect source (only once — singletons survive remounts)
    if (!_analyser) {
      _analyser = _audioCtx.createAnalyser();
      _analyser.fftSize = 256;
      _analyser.smoothingTimeConstant = 0.85;
      try {
        const source = _audioCtx.createMediaElementSource(audio);
        source.connect(_analyser);
        _analyser.connect(_audioCtx.destination);
      } catch (_) { /* already connected on remount */ }
      _dataArray = new Uint8Array(_analyser.frequencyBinCount);
    }

    // Resume AudioContext on any user interaction (required by browser autoplay policy)
    const resumeCtx = () => {
      if (_audioCtx?.state === 'suspended') _audioCtx.resume().catch(() => {});
    };
    document.addEventListener('click', resumeCtx);
    document.addEventListener('keydown', resumeCtx);

    // RAF loop — writes directly to DOM, zero React re-renders
    let rafId = null;
    const barCount = EQ_HEIGHTS.length;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      if (!_analyser || !_dataArray) return;

      _analyser.getByteFrequencyData(_dataArray);
      const playing = isPlayingRef.current;
      const bufLen = _analyser.frequencyBinCount;
      // Fast response when playing, slow graceful fall-off when paused
      const smooth = playing ? 0.35 : 0.06;

      for (let i = 0; i < barCount; i++) {
        const el = barRefs.current[i];
        if (!el) continue;
        const idx = Math.floor((i * bufLen) / barCount);
        const raw = _dataArray[idx] / 255;
        const target = playing ? Math.max(0.08, raw) : 0.08;
        displayValuesRef.current[i] += (target - displayValuesRef.current[i]) * smooth;
        el.style.transform = `scaleY(${displayValuesRef.current[i].toFixed(3)})`;
      }
    };

    tick();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener('click', resumeCtx);
      document.removeEventListener('keydown', resumeCtx);
    };
  }, [audio]);


  // Default cover as SVG data URI (avoid 404 on missing file)
  const defaultCover = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='300' height='300' fill='%23000'/%3E%3Ctext x='150' y='150' font-family='Arial' font-size='60' fill='%23F4D03F' text-anchor='middle' dominant-baseline='middle'%3E%E2%99%AB%3C/text%3E%3C/svg%3E";

  // Cover preload to avoid flicker
  const [displayedCover, setDisplayedCover] = useState(defaultCover);
  const pendingCoverRef = useRef(null);

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      // Near-end: trigger next song 2 seconds before actual end for gapless playback
      if (
        !transitionedRef.current &&
        audio.duration > 5 &&
        (audio.duration - audio.currentTime) <= 2
      ) {
        transitionedRef.current = true;
        handleNextRef.current?.();
      }
    };
    const updateDuration = () => setDuration(audio.duration || 0);

    const handlePlay = () => {
      setPlaybackStartTime(Date.now());
      hasRecordedPlay.current = false;
    };

    const handlePause = () => {
      if (playbackStartTime) {
        const secondsPlayed = Math.floor((Date.now() - playbackStartTime) / 1000);
        setTotalSecondsPlayed(prev => prev + secondsPlayed);
        setPlaybackStartTime(null);
      }
    };

    const handleEnded = () => {
      if (transitionedRef.current) return; // already transitioned 2s early
      transitionedRef.current = true;
      handlePause();
      recordPlayHistory();
      handleNext();
    };

    const handleWaiting = () => setIsBuffering(true);
    const handleCanPlay = () => setIsBuffering(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("canplay", handleCanPlay);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, [audio, playbackStartTime]);

  useEffect(() => {
    return () => {
      if (totalSecondsPlayed > 0 && !hasRecordedPlay.current) {
        recordPlayHistory();
      }
    };
  }, [state.currentSong?.id, totalSecondsPlayed]);

  const recordPlayHistory = async () => {
    if (hasRecordedPlay.current || totalSecondsPlayed === 0) return;
    hasRecordedPlay.current = true;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !state.currentSong?.id) return;

      // Skip analytics for admin/manager — they test the system, not actual venue listeners
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile?.role === 'admin' || profile?.role === 'manager') return;

      await recordPlay(
        user.id,
        state.currentSong.id,
        state.currentSong.playlistId || null,
        totalSecondsPlayed,
        'GT'
      );
    } catch (error) {
      console.error('Error in recordPlayHistory:', error);
    } finally {
      setTotalSecondsPlayed(0);
    }
  };

  const handlePlayPause = () => {
    if (!state.currentSong) return;
    dispatch({ type: "TOGGLE_PLAY_PAUSE" });
  };

  const handlePrevious = () => {
    const { playlist, songIndex } = state.currentPlaylist || {};
    if (!playlist || songIndex === undefined || songIndex === -1) return;
    const prevIndex = (songIndex - 1 + playlist.length) % playlist.length;
    dispatch({ type: "PREV_SONG", payload: playlist[prevIndex] });
  };

  const handleNext = () => {
    const { playlist, songIndex } = state.currentPlaylist || {};
    if (!playlist || songIndex === undefined || songIndex === -1) return;
    const nextIndex = (songIndex + 1) % playlist.length;
    dispatch({ type: "NEXT_SONG", payload: playlist[nextIndex] });
  };
  // Keep ref always pointing to latest handleNext (avoids stale closure in timeupdate)
  handleNextRef.current = handleNext;

  // Reset transition flag whenever a new song starts
  useEffect(() => {
    transitionedRef.current = false;
  }, [state.currentSong?.id]);

  // Keyboard shortcut: spacebar toggles play/pause
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code !== 'Space') return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
      e.preventDefault();
      if (!state.currentSong) return;
      dispatch({ type: 'TOGGLE_PLAY_PAUSE' });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.currentSong, dispatch]);

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    audio.volume = newVolume;
  };

  const handleSeek = (e) => {
    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    audio.currentTime = seekTime;
  };

  const coverImageSrc = useMemo(() => {
    return state?.currentSong?.coverImage || defaultCover;
  }, [state?.currentSong?.coverImage, defaultCover]);

  // Preload cover and set with fade to avoid flicker
  useEffect(() => {
    if (!coverImageSrc) return;
    pendingCoverRef.current = coverImageSrc;
    const img = new Image();
    img.src = coverImageSrc;
    img.onload = () => {
      if (pendingCoverRef.current === coverImageSrc) {
        setDisplayedCover(coverImageSrc);
      }
    };
  }, [coverImageSrc]);


  const TinyText = styled(Typography)({
    fontSize: "0.75rem",
    color: "#F4D03F",
    fontWeight: 500,
    letterSpacing: 0.2,
  });

  const CoverImage = styled("div")({
    width: 75,
    height: 75,
    objectFit: "cover",
    overflow: "hidden",
    flexShrink: 0,
    borderRadius: 12,
    border: "2px solid #F4D03F",
    backgroundColor: "#1a1a1a",
    "& > img": {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      transition: 'opacity 240ms ease',
      opacity: 1,
    },
  });

  if (!state.currentSong) {
    return null;
  }

  return (
    <footer className="bg-black text-ayau-gold flex flex-col border-t-2 border-ayau-gold">
      {/* Seek bar row with times on each side */}
      <div className="flex items-center gap-3 px-6 lg:px-10 pt-2">
        <TinyText sx={{ minWidth: 36, textAlign: 'right' }}>{formatTime(currentTime)}</TinyText>
        <Slider
          sx={{
            flex: 1,
            color: "#F4D03F",
            height: 6,
            padding: '4px 0',
            '& .MuiSlider-thumb': {
              width: 14,
              height: 14,
              backgroundColor: '#F4D03F',
              '&:hover': {
                boxShadow: '0 0 0 8px rgba(244, 208, 63, 0.16)',
              },
            },
            '& .MuiSlider-track': { backgroundColor: '#F4D03F' },
            '& .MuiSlider-rail': { backgroundColor: '#333' },
          }}
          aria-label="Seek"
          min={0}
          max={duration}
          value={currentTime}
          onChange={handleSeek}
        />
        <TinyText sx={{ minWidth: 36 }}>-{formatTime(duration - currentTime)}</TinyText>
      </div>
      <div className="flex justify-between items-center px-6 lg:px-10 py-3">
        <Box className="w-1/4 lg:w-1/4" sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <CoverImage>
            <img alt="album cover" src={displayedCover} />
          </CoverImage>
          <Box className="min-w-0 flex-1">
            <Typography noWrap fontWeight="bold" sx={{ color: '#F4D03F', fontSize: '1.1rem' }}>
              {state?.currentSong?.title || 'Unknown Title'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography noWrap variant="body2" sx={{ color: '#F4D03F99', fontSize: '0.9rem', flex: 1 }}>
                {state?.currentSong?.performer || 'Unknown Artist'}
              </Typography>
              <SyncStatusIndicator compact />
            </Box>
          </Box>
        </Box>

        <Box className="flex flex-col items-center w-2/4">
          {/* Real-time EQ visualizer — bars updated directly via RAF, no React re-renders */}
          <Box sx={{ width: '70%', mb: 1, height: 50, backgroundColor: '#1a1a1a', borderRadius: '4px', border: '1px solid #F4D03F33', display: 'flex', alignItems: 'flex-end', px: '6px', py: '4px', gap: '2px', overflow: 'hidden' }}>
            {EQ_HEIGHTS.map((h, i) => (
              <div
                key={i}
                ref={el => { barRefs.current[i] = el; }}
                style={{
                  flex: 1,
                  height: `${h}%`,
                  borderRadius: '2px',
                  background: 'linear-gradient(to top, #FFD700, #F4D03F88)',
                  transformOrigin: 'bottom',
                  transform: 'scaleY(0.08)',
                  willChange: 'transform',
                }}
              />
            ))}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
            <IconButton
              aria-label="previous song"
              onClick={handlePrevious}
              sx={{
                color: '#F4D03F',
                '&:hover': { backgroundColor: '#F4D03F22' }
              }}
            >
              <FastRewindRounded fontSize="large" />
            </IconButton>
            <IconButton
              aria-label={isBuffering ? "loading" : !state?.isPlaying ? "play" : "pause"}
              onClick={handlePlayPause}
              disabled={isBuffering}
              sx={{
                color: '#F4D03F',
                border: '2px solid #F4D03F',
                padding: '12px',
                position: 'relative',
                '&:hover': {
                  backgroundColor: '#F4D03F22',
                  border: '2px solid #F4D03F',
                }
              }}
            >
              {isBuffering ? (
                <CircularProgress size={32} sx={{ color: '#F4D03F' }} />
              ) : !state?.isPlaying ? (
                <PlayArrowRounded sx={{ fontSize: "2rem" }} />
              ) : (
                <PauseRounded sx={{ fontSize: "2rem" }} />
              )}
            </IconButton>
            <IconButton
              aria-label="next song"
              onClick={handleNext}
              sx={{
                color: '#F4D03F',
                '&:hover': { backgroundColor: '#F4D03F22' }
              }}
            >
              <FastForwardRounded fontSize="large" />
            </IconButton>
          </Box>
        </Box>

        <Box className="w-1/4 flex items-center justify-end gap-2">
          <VolumeDownRounded sx={{ color: '#F4D03F' }} />
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolumeChange}
            aria-label="Volume"
            sx={{
              width: 120,
              color: '#F4D03F',
              '& .MuiSlider-track': {
                border: "none",
                backgroundColor: '#F4D03F',
              },
              '& .MuiSlider-rail': {
                backgroundColor: '#333',
              },
              '& .MuiSlider-thumb': {
                width: 16,
                height: 16,
                backgroundColor: "#F4D03F",
                '&:hover': {
                  boxShadow: '0 0 0 8px rgba(244, 208, 63, 0.16)',
                },
              },
            }}
          />
          <VolumeUpRounded sx={{ color: '#F4D03F' }} />
        </Box>
      </div>
    </footer>
  );
}
