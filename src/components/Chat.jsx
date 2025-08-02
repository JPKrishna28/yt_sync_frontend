import React, { useState, useEffect, useRef } from 'react';

const Chat = ({ socket, roomId, userId, connected }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState('');
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    // Listen for new messages
    socket.on('chat-message', (messageData) => {
      setMessages(prevMessages => [...prevMessages, messageData]);
    });

    // Listen for typing indicators
    socket.on('user-typing', (data) => {
      if (data.userId !== userId) {
        setTypingUser(data.username || 'Someone');
        setIsTyping(true);
        
        // Clear typing indicator after 3 seconds
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

    // Cleanup
    return () => {
      socket.off('chat-message');
      socket.off('user-typing');
      socket.off('user-stopped-typing');
    };
  }, [socket, userId]);

  // Auto-scroll to bottom when new messages arrive
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
      username: `User ${userId.slice(-4)}`, // Use last 4 chars of user ID as username
      message: newMessage.trim(),
      timestamp: new Date().toISOString()
    };

    // Emit message to server
    socket.emit('chat-message', messageData);
    
    // Clear input
    setNewMessage('');
    
    // Stop typing indicator
    socket.emit('user-stopped-typing', { roomId, userId });
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    
    if (!socket) return;

    // Emit typing indicator
    socket.emit('user-typing', { roomId, userId });
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('user-stopped-typing', { roomId, userId });
    }, 1000);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!roomId) {
    return (
      <div className="chat-container">
        <div className="chat-placeholder">
          <p>Join a room to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h3>Chat</h3>
        <div className="chat-status">
          {connected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </div>
      
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

export default Chat;
