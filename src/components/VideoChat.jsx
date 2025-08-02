import React, { useState, useEffect, useRef } from 'react';

const VideoChat = ({ socket, roomId, userId, connected }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [isCallInitiator, setIsCallInitiator] = useState(false);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const pendingCandidatesRef = useRef([]);

  // WebRTC configuration
  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    if (!socket) return;

    // Chat message listeners
    socket.on('chat-message', (messageData) => {
      setMessages(prevMessages => [...prevMessages, messageData]);
    });

    socket.on('user-typing', (data) => {
      if (data.userId !== userId) {
        setTypingUser(data.username || 'Someone');
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          setTypingUser('');
        }, 3000);
      }
    });

    socket.on('user-stopped-typing', (data) => {
      if (data.userId !== userId) {
        setIsTyping(false);
        setTypingUser('');
      }
    });

    // WebRTC signaling listeners
    socket.on('call-offer', async (data) => {
      console.log('Received call offer');
      if (!isInCall) {
        await handleReceiveOffer(data.offer);
      }
    });

    socket.on('call-answer', async (data) => {
      console.log('Received call answer');
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(data.answer);
        
        // Add any pending ICE candidates
        for (const candidate of pendingCandidatesRef.current) {
          await peerConnectionRef.current.addIceCandidate(candidate);
        }
        pendingCandidatesRef.current = [];
      }
    });

    socket.on('ice-candidate', async (data) => {
      console.log('Received ICE candidate');
      if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
        await peerConnectionRef.current.addIceCandidate(data.candidate);
      } else {
        // Store candidates if remote description isn't set yet
        pendingCandidatesRef.current.push(data.candidate);
      }
    });

    socket.on('call-ended', () => {
      console.log('Call ended by remote user');
      handleEndCall();
    });

    socket.on('video-toggle', (data) => {
      setRemoteVideoEnabled(data.enabled);
    });

    return () => {
      socket.off('chat-message');
      socket.off('user-typing');
      socket.off('user-stopped-typing');
      socket.off('call-offer');
      socket.off('call-answer');
      socket.off('ice-candidate');
      socket.off('call-ended');
      socket.off('video-toggle');
    };
  }, [socket, userId, isInCall]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !socket || !connected) return;

    const messageData = {
      roomId,
      userId,
      username: `User ${userId.slice(-4)}`,
      message: newMessage.trim(),
      timestamp: new Date().toISOString()
    };

    socket.emit('chat-message', messageData);
    setNewMessage('');
    socket.emit('user-stopped-typing', { roomId, userId });
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    
    if (!socket) return;

    socket.emit('user-typing', { roomId, userId });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('user-stopped-typing', { roomId, userId });
    }, 1000);
  };

  const startLocalVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setIsVideoEnabled(true);
      setIsAudioEnabled(true);
      return stream;
    } catch (error) {
      console.error('Error accessing camera/microphone:', error);
      alert('Could not access camera/microphone. Please check permissions.');
      return null;
    }
  };

  const stopLocalVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    setIsVideoEnabled(false);
    setIsAudioEnabled(false);
  };

  const createPeerConnection = () => {
    const peerConnection = new RTCPeerConnection(rtcConfiguration);
    
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', {
          roomId,
          candidate: event.candidate
        });
      }
    };
    
    peerConnection.ontrack = (event) => {
      console.log('Received remote stream');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
    
    return peerConnection;
  };

  const handleStartCall = async () => {
    const stream = await startLocalVideo();
    if (!stream) return;

    setIsCallInitiator(true);
    setIsInCall(true);
    
    const peerConnection = createPeerConnection();
    peerConnectionRef.current = peerConnection;
    
    // Add local stream to peer connection
    stream.getTracks().forEach(track => {
      peerConnection.addTrack(track, stream);
    });
    
    // Create offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    // Send offer to remote peer
    socket.emit('call-offer', {
      roomId,
      offer
    });
  };

  const handleReceiveOffer = async (offer) => {
    const stream = await startLocalVideo();
    if (!stream) return;

    setIsInCall(true);
    
    const peerConnection = createPeerConnection();
    peerConnectionRef.current = peerConnection;
    
    // Add local stream to peer connection
    stream.getTracks().forEach(track => {
      peerConnection.addTrack(track, stream);
    });
    
    // Set remote description and create answer
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    // Send answer to remote peer
    socket.emit('call-answer', {
      roomId,
      answer
    });
  };

  const handleEndCall = () => {
    if (isCallInitiator) {
      socket.emit('call-ended', { roomId });
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    stopLocalVideo();
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    setIsInCall(false);
    setIsCallInitiator(false);
    setRemoteVideoEnabled(false);
    pendingCandidatesRef.current = [];
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        
        socket.emit('video-toggle', {
          roomId,
          enabled: videoTrack.enabled
        });
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!roomId) {
    return (
      <div className="video-chat-container">
        <div className="chat-placeholder">
          <p>Join a room to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="video-chat-container">
      <div className="chat-header">
        <h3>Chat & Video</h3>
        <div className="chat-status">
          {connected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </div>
      
      {/* Video Section */}
      <div className="video-section">
        <div className="video-controls">
          {!isInCall ? (
            <button 
              className="video-call-btn start-call"
              onClick={handleStartCall}
              disabled={!connected}
            >
              📹 Start Video Call
            </button>
          ) : (
            <div className="call-controls">
              <button 
                className={`control-btn video-btn ${isVideoEnabled ? 'active' : ''}`}
                onClick={toggleVideo}
              >
                {isVideoEnabled ? '📹' : '📹❌'}
              </button>
              <button 
                className={`control-btn audio-btn ${isAudioEnabled ? 'active' : ''}`}
                onClick={toggleAudio}
              >
                {isAudioEnabled ? '🎤' : '🎤❌'}
              </button>
              <button 
                className="control-btn end-call-btn"
                onClick={handleEndCall}
              >
                📞❌
              </button>
            </div>
          )}
        </div>
        
        {isInCall && (
          <div className="video-streams">
            <div className="video-stream local">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="video-element"
              />
              <span className="video-label">You</span>
            </div>
            <div className="video-stream remote">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="video-element"
              />
              <span className="video-label">Remote User</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Chat Section */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div 
              key={index} 
              className={`message ${message.userId === userId ? 'own-message' : 'other-message'}`}
            >
              <div className="message-header">
                <span className="username">{message.username}</span>
                <span className="timestamp">{formatTime(message.timestamp)}</span>
              </div>
              <div className="message-content">
                {message.message}
              </div>
            </div>
          ))
        )}
        
        {isTyping && typingUser && (
          <div className="typing-indicator">
            <span>{typingUser} is typing...</span>
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={newMessage}
          onChange={handleInputChange}
          placeholder="Type a message..."
          disabled={!connected}
          maxLength={500}
        />
        <button 
          type="submit" 
          disabled={!newMessage.trim() || !connected}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default VideoChat;
