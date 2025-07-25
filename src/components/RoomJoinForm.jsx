import React, { useState } from 'react';

const RoomJoinForm = ({ onJoinRoom }) => {
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!roomId.trim()) {
      setError('Please enter a room ID');
      return;
    }
    
    setError('');
    onJoinRoom(roomId);
  };

  const handleRandomRoom = () => {
    // Generate a random room ID (mix of letters and numbers)
    const randomId = Math.random().toString(36).substring(2, 8);
    setRoomId(randomId);
  };

  return (
    <div className="join-container">
      <h2>Join a Video Sync Room</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          className="room-input"
          placeholder="Enter room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
          <button type="submit" className="join-button">
            Join Room
          </button>
          <button 
            type="button" 
            className="join-button" 
            style={{ backgroundColor: '#555' }}
            onClick={handleRandomRoom}
          >
            Random
          </button>
        </div>
      </form>
      {error && <p className="status-message error">{error}</p>}
      <p className="status-message info">
        Enter a room ID to join an existing room or create a new one. Share the Room ID with a friend to watch together!
      </p>
    </div>
  );
};

export default RoomJoinForm;
