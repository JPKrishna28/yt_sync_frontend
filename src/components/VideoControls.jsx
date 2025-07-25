import React from 'react';

const VideoControls = ({ onPlay, onPause, onSync }) => {
  return (
    <div>
      <div className="controls">
        <button onClick={onPlay} className="control-button">
          Play
        </button>
        <button onClick={onPause} className="control-button">
          Pause
        </button>
        <button onClick={onSync} className="control-button">
          Sync
        </button>
      </div>
    </div>
  );
};

export default VideoControls;
