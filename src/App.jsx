import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import RoomJoinForm from './components/RoomJoinForm';
import YouTubePlayer from './components/YouTubePlayer';
import VideoControls from './components/VideoControls';
import YouTubeSearch from './components/YouTubeSearch';

// Connection to the WebSocket server with explicit options
// Only create the socket when the component mounts
function App() {
  // State variables
  const [connected, setConnected] = useState(false);
  const [inRoom, setInRoom] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [userId, setUserId] = useState('');
  const [usersCount, setUsersCount] = useState(0);
  const [videoId, setVideoId] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isFirstUser, setIsFirstUser] = useState(false);
  
  // Reference to the YouTube player and socket
  const playerRef = useRef(null);
  const socketRef = useRef(null);
  
  // Flag to prevent event loops
  const ignoringEvents = useRef(false);
  
  // Initialize socket connection
  useEffect(() => {
    // Create socket connection
    const SOCKET_SERVER_URL = 'https://yt-sync-backend.onrender.com';
    const socket = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      forceNew: true
    });
    
    socketRef.current = socket;
    
    // Connection established
    socket.on('connect', () => {
      console.log('Connected to server with ID:', socket.id);
      setConnected(true);
      setStatusMessage('Connected to server');
    });
    
    // Connection lost
    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
      setStatusMessage('Disconnected from server');
    });
    
    // Room joined successfully
    socket.on('room-joined', (data) => {
      console.log('Room joined event received:', data);
      setRoomId(data.roomId);
      setUserId(data.userId);
      setInRoom(true);
      setIsFirstUser(data.isFirstUser);
      setStatusMessage(`Joined room: ${data.roomId}`);
      
      // Load a default video if first user
      if (data.isFirstUser && !videoId) {
        // Default video: YouTube API introduction
        setVideoId('D6tDlm9B5Eg');
        
        // Broadcast the video to other users who join
        setTimeout(() => {
          socketRef.current.emit('video-action', {
            roomId: data.roomId,
            action: 'videoChange',
            currentTime: 0,
            videoId: 'D6tDlm9B5Eg'
          });
        }, 1000); // Small delay to ensure socket is ready
      }
    });
    
    // Room is full (2 users max)
    socket.on('room-full', () => {
      console.log('Room full event received');
      setStatusMessage('Room is full (max 2 users)');
    });
    
    // User connected/disconnected events
    socket.on('user-connected', (data) => {
      console.log('User connected event:', data);
      setUsersCount(data.usersCount);
      setStatusMessage(`User connected. Total users: ${data.usersCount}`);
    });
    
    socket.on('user-disconnected', (data) => {
      console.log('User disconnected event:', data);
      setUsersCount(data.usersCount);
      setStatusMessage(`User disconnected. Total users: ${data.usersCount}`);
    });
    
    // Video sync events
    socket.on('video-action', (data) => {
      // Ignore events we triggered ourselves
      if (ignoringEvents.current) return;
      
      const player = playerRef.current;
      if (!player) return;
      
      console.log('Received video action:', data);
      
      // Handle different action types
      switch (data.action) {
        case 'videoChange':
          // Update the video ID when another user loads a video
          console.log('Received video change to:', data.videoId);
          setVideoId(data.videoId);
          setStatusMessage(`Other user changed video`);
          break;
          
        case 'play':
          // Set time then play
          player.seekTo(data.currentTime);
          player.play();
          break;
        
        case 'pause':
          player.pause();
          break;
          
        case 'seek':
          player.seekTo(data.currentTime);
          break;
          
        default:
          break;
      }
    });
    
    // Clean up socket connection when component unmounts
    return () => {
      console.log('Cleaning up socket connection');
      socket.disconnect();
      socketRef.current = null;
    };
  }, []); // Empty dependency array - only run on mount/unmount
  
  // Join a room
  const handleJoinRoom = (roomIdInput) => {
    console.log('Attempting to join room:', roomIdInput);
    
    if (!connected || !socketRef.current) {
      console.log('Not connected to server');
      setStatusMessage('Not connected to server');
      return;
    }
    
    console.log('Emitting join-room event for room:', roomIdInput);
    socketRef.current.emit('join-room', roomIdInput);
  };
  
  // Send video action to other users
  const sendVideoAction = (action, currentTime) => {
    if (!socketRef.current || !inRoom) {
      console.log('Cannot send video action: not connected or not in a room');
      return;
    }
    
    // Don't trigger events for a short time to avoid loops
    ignoringEvents.current = true;
    setTimeout(() => {
      ignoringEvents.current = false;
    }, 500);
    
    console.log('Sending video action:', action, currentTime || playerRef.current?.getCurrentTime() || 0);
    
    socketRef.current.emit('video-action', {
      roomId,
      action,
      currentTime: currentTime || playerRef.current?.getCurrentTime() || 0,
      videoId
    });
  };
  
  // Video control handlers
  const handleVideoChange = (newVideoId) => {
    console.log('Video changed to:', newVideoId);
    setVideoId(newVideoId);
    
    // Make sure to send the videoId to other users in the room
    if (socketRef.current && roomId) {
      socketRef.current.emit('video-action', {
        roomId,
        action: 'videoChange',
        currentTime: 0,
        videoId: newVideoId
      });
      
      // Show status message
      setStatusMessage(`Video changed: ${newVideoId}`);
    }
  };
  
  const handlePlay = () => {
    if (playerRef.current) {
      playerRef.current.play();
      sendVideoAction('play');
    }
  };
  
  const handlePause = () => {
    if (playerRef.current) {
      playerRef.current.pause();
      sendVideoAction('pause');
    }
  };
  
  const handleSync = () => {
    if (playerRef.current) {
      const currentTime = playerRef.current.getCurrentTime();
      sendVideoAction('seek', currentTime);
    }
  };
  
  // YouTube player event handlers
  const handlePlayerStateChange = (event) => {
    if (ignoringEvents.current) return;
    
    // YT.PlayerState values: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
    const player = playerRef.current;
    
    if (event.data === 1) { // Playing
      sendVideoAction('play');
    } else if (event.data === 2) { // Paused
      sendVideoAction('pause');
    }
  };
  
  return (
    <div className="container">
      <h1>YouTube Sync App</h1>
      
      {usersCount > 0 && (
        <div className="user-count">
          Users: {usersCount}/2
        </div>
      )}
      
      {!inRoom ? (
        <RoomJoinForm onJoinRoom={handleJoinRoom} />
      ) : (
        <div className="video-container">
          <h2>Room: {roomId}</h2>
          
          {/* YouTube Search Component */}
          <YouTubeSearch onVideoSelect={handleVideoChange} />
          
          {videoId ? (
            <YouTubePlayer
              ref={playerRef}
              videoId={videoId}
              onStateChange={handlePlayerStateChange}
            />
          ) : (
            <div className="video-iframe">
              <p style={{ textAlign: 'center', paddingTop: '40%' }}>
                {isFirstUser 
                  ? 'Search for a YouTube video above to start watching'
                  : 'Waiting for the other user to load a video'}
              </p>
            </div>
          )}
          
          <VideoControls
            onPlay={handlePlay}
            onPause={handlePause}
            onSync={handleSync}
          />
          
          {statusMessage && (
            <p className="status-message info">{statusMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
