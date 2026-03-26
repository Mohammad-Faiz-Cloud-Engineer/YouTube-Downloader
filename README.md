# YouTube Downloader

A full-featured YouTube video and audio downloader with a modern web interface.

## Features

- Download YouTube videos in multiple quality options (360p, 480p, 720p, 1080p)
- Extract audio as MP3 (320kbps)
- Support for playlist downloads
- Clean, modern UI with real-time progress tracking
- Automatic file cleanup after download

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd yt-downloader
```

2. Install dependencies:
```bash
npm install
```

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Paste a YouTube URL and select your preferred download option

## Environment Variables

- `PORT` - Server port (default: 3000)

## Project Structure

```
yt-downloader/
├── server.js           # Express server and API endpoints
├── public/
│   └── index.html     # Frontend UI
├── downloads/         # Temporary download directory
├── package.json       # Project dependencies
└── README.md         # This file
```

## API Endpoints

### POST /api/info
Fetch video or playlist information
- Body: `{ url: string }`
- Returns: Video metadata, thumbnail, available qualities

### POST /api/download/video
Download video in specified quality
- Body: `{ url: string, quality: string }`
- Returns: Video file stream

### POST /api/download/audio
Extract and download audio as MP3
- Body: `{ url: string }`
- Returns: MP3 file stream

### POST /api/download/playlist
Download entire playlist
- Body: `{ url: string, quality: string }`
- Returns: Download status and count

## Security Notes

- All user inputs are validated before processing
- File paths are sanitized to prevent directory traversal
- Temporary files are automatically cleaned up after download
- No sensitive data is logged

## License

MIT

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
