import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const YouTubePlayer = forwardRef(({ videoId, onPlayerReady, onStateChange }, ref) => {
  const playerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    // Load YouTube API if not already loaded
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      
      window.onYouTubeIframeAPIReady = initPlayer;
    } else {
      initPlayer();
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [videoId]);

  const initPlayer = () => {
    if (!videoId) return;
    
    // Wait for API to be ready
    if (!window.YT || !window.YT.Player) {
      setTimeout(initPlayer, 100);
      return;
    }

    // Create player instance with more options for searching
    playerRef.current = new window.YT.Player(containerRef.current, {
      videoId,
      playerVars: {
        autoplay: 0,
        controls: 1,
        modestbranding: 1,
        rel: 0,
        enablejsapi: 1,
        origin: window.location.origin
      },
      events: {
        onReady: (event) => {
          console.log('Player ready');
          if (onPlayerReady) onPlayerReady(event.target);
        },
        onStateChange: (event) => {
          console.log('Player state changed:', event.data);
          if (onStateChange) onStateChange(event);
        }
      }
    });
  };
  
  // Exposing player methods via ref
  useImperativeHandle(ref, () => ({
    play: () => playerRef.current?.playVideo(),
    pause: () => playerRef.current?.pauseVideo(),
    seekTo: (seconds) => playerRef.current?.seekTo(seconds, true),
    getCurrentTime: () => playerRef.current?.getCurrentTime() || 0,
    getVideoId: () => videoId,
    loadVideoById: (videoId) => playerRef.current?.loadVideoById(videoId)
  }));

  return <div ref={containerRef} className="video-iframe" />;
});

export default YouTubePlayer;
