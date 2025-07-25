import React, { useState } from 'react';

const YouTubeSearch = ({ onVideoSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) return;
    
    // Try to extract a YouTube video ID if it's a URL
    const urlPattern = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = searchQuery.match(urlPattern);
    
    if (match && match[1]) {
      // It's a URL with a video ID
      console.log('Extracted video ID from URL:', match[1]);
      onVideoSelect(match[1]);
    } else if (/^[a-zA-Z0-9_-]{11}$/.test(searchQuery)) {
      // It's already a video ID (11 characters)
      console.log('Using direct video ID:', searchQuery);
      onVideoSelect(searchQuery);
    } else {
      // For demonstration, if not a URL or video ID, show a helpful message
      alert('Please enter a valid YouTube URL or video ID (11 characters).\n\nExample URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ\nExample ID: dQw4w9WgXcQ');
    }
    
    setSearchQuery('');
  };

  return (
    <div className="youtube-search">
      <form onSubmit={handleSearch}>
        <input
          type="text"
          className="search-input"
          placeholder="Enter YouTube URL or video ID"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button type="submit" className="search-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style={{ marginRight: '5px' }}>
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
          </svg>
          Load Video
        </button>
      </form>
      <div className="search-helper">
        <small>Enter a YouTube URL or 11-character video ID to load a video for all users in the room</small>
      </div>
    </div>
  );
};

export default YouTubeSearch;
