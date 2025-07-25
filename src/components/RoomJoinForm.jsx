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
        <button type="submit" className="join-button">
          Join Room
        </button>
      </form>
      {error && <p className="status-message error">{error}</p>}
      <p className="status-message info">
        Enter a room ID to join an existing room or create a new one.
      </p>
    </div>
  );
};

export default RoomJoinForm;
