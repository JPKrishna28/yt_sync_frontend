import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import RoomJoinForm from './components/RoomJoinForm';
import YouTubePlayer from './components/YouTubePlayer';
import VideoControls from './components/VideoControls';
import YouTubeSearch from './components/YouTubeSearch';
import VideoChat from './components/VideoChat';

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
    
    // Room is full (10 users max)
    socket.on('room-full', () => {
      console.log('Room full event received');
      setStatusMessage('Room is full (max 10 users)');
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
      setStatusMessage(`Synced video at ${Math.floor(currentTime / 60)}:${Math.floor(currentTime % 60).toString().padStart(2, '0')}`);
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
          Online: {usersCount}/2
        </div>
      )}
      
      {!inRoom ? (
        <RoomJoinForm onJoinRoom={handleJoinRoom} />
      ) : (
        <div className="main-content">
          <div className="video-section">
            <div className="room-header">
              <h2>YouTube Sync Room</h2>
              <div className="room-id">Room ID: {roomId}</div>
            </div>
            
            {/* YouTube Search Component */}
            <YouTubeSearch onVideoSelect={handleVideoChange} />
            
            {videoId ? (
              <YouTubePlayer
                ref={playerRef}
                videoId={videoId}
                onStateChange={handlePlayerStateChange}
              />
            ) : (
              <div className="video-iframe placeholder">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8.051 1.999h.089c.822.003 4.987.033 6.11.335a2.01 2.01 0 0 1 1.415 1.42c.101.38.172.883.22 1.402l.01.104.022.26.008.104c.065.914.073 1.77.074 1.957v.075c-.001.194-.01 1.108-.082 2.06l-.008.105-.009.104c-.05.572-.124 1.14-.235 1.558a2.007 2.007 0 0 1-1.415 1.42c-1.16.312-5.569.334-6.18.335h-.142c-.309 0-1.587-.006-2.927-.052l-.17-.006-.087-.004-.171-.007-.171-.007c-1.11-.049-2.167-.128-2.654-.26a2.007 2.007 0 0 1-1.415-1.419c-.111-.417-.185-.986-.235-1.558L.09 9.82l-.008-.104A31.4 31.4 0 0 1 0 7.68v-.123c.002-.215.01-.958.064-1.778l.007-.103.003-.052.008-.104.022-.26.01-.104c.048-.519.119-1.023.22-1.402a2.007 2.007 0 0 1 1.415-1.42c.487-.13 1.544-.21 2.654-.26l.17-.007.172-.006.086-.003.171-.007A99.788 99.788 0 0 1 7.858 2h.193zM6.4 5.209v4.818l4.157-2.408L6.4 5.209z"/>
                </svg>
                <p>
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
          
          <div className="chat-section">
            <VideoChat 
              socket={socketRef.current}
              roomId={roomId}
              userId={userId}
              connected={connected}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
