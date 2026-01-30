import { useState, useEffect, useRef, useMemo } from "react";
import Box from "@mui/material/Box";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
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

export default function MusicPlayer() {
  const { state, dispatch } = usePlayer();
  const audio = state.audio;

  const [volume, setVolume] = useState(audio.volume || 0.5);
  const [currentTime, setCurrentTime] = useState(audio.currentTime);
  const [duration, setDuration] = useState(audio.duration || 0);

  // Tracking de reproducción
  const [playbackStartTime, setPlaybackStartTime] = useState(null);
  const [totalSecondsPlayed, setTotalSecondsPlayed] = useState(0);
  const hasRecordedPlay = useRef(false);

  useEffect(() => {
    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);

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
      handlePause();
      recordPlayHistory();
      handleNext();
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
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
    const prevSong = playlist[prevIndex];
    dispatch({ type: "PREV_SONG", payload: prevSong });
  };

  const handleNext = () => {
    const { playlist, songIndex } = state.currentPlaylist || {};
    if (!playlist || songIndex === undefined || songIndex === -1) return;
    const nextIndex = (songIndex + 1) % playlist.length;
    const nextSong = playlist[nextIndex];
    dispatch({ type: "NEXT_SONG", payload: nextSong });
  };

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
    return state?.currentSong?.coverImage || '/default-cover.png';
  }, [state?.currentSong?.coverImage]);

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
    },
  });

  if (!state.currentSong) {
    return null;
  }

  return (
    <footer className="bg-black text-ayau-gold flex flex-col border-t-2 border-ayau-gold">
      <div className="w-full">
        <Slider
          sx={{
            color: "#F4D03F",
            height: 6,
            padding: 0,
            '& .MuiSlider-thumb': {
              width: 16,
              height: 16,
              backgroundColor: '#F4D03F',
              '&:hover': {
                boxShadow: '0 0 0 8px rgba(244, 208, 63, 0.16)',
              },
            },
            '& .MuiSlider-track': {
              backgroundColor: '#F4D03F',
            },
            '& .MuiSlider-rail': {
              backgroundColor: '#333',
            },
          }}
          aria-label="Seek"
          min={0}
          max={duration}
          value={currentTime}
          onChange={handleSeek}
        />
      </div>
      <div className="flex justify-between items-center px-6 lg:px-10 py-4">
        <Box className="w-1/4 lg:w-1/4" sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <CoverImage>
            <img alt="album cover" src={coverImageSrc} />
          </CoverImage>
          <Box className="min-w-0 flex-1">
            <Typography noWrap fontWeight="bold" sx={{ color: '#F4D03F', fontSize: '1.1rem' }}>
              {state?.currentSong?.title || 'Unknown Title'}
            </Typography>
            <Typography noWrap variant="body2" sx={{ color: '#F4D03F99', fontSize: '0.9rem' }}>
              {state?.currentSong?.performer || 'Unknown Artist'}
            </Typography>
          </Box>
        </Box>

        <Box className="flex flex-col items-center w-2/4">
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
              aria-label={!state?.isPlaying ? "play" : "pause"}
              onClick={handlePlayPause}
              sx={{
                color: '#F4D03F',
                border: '2px solid #F4D03F',
                padding: '12px',
                '&:hover': {
                  backgroundColor: '#F4D03F22',
                  border: '2px solid #F4D03F',
                }
              }}
            >
              {!state?.isPlaying ? (
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
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: '100%', mt: 1 }}>
            <TinyText>{formatTime(currentTime)}</TinyText>
            <TinyText>-{formatTime(duration - currentTime)}</TinyText>
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
