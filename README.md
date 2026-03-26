---
title: YouTube Downloader
emoji: 🎬
colorFrom: red
colorTo: gray
sdk: docker
app_port: 3000
pinned: false
license: mit
---

# YouTube Downloader

A full-featured YouTube video and audio downloader with a clean web interface. Download videos in multiple resolutions or extract audio as high-quality MP3.

**Live Website:** [https://rox-turbo-yt.hf.space/](https://rox-turbo-yt.hf.space/)  
**Author:** [Mohammad Faiz](https://github.com/Mohammad-Faiz-Cloud-Engineer)  
**Repository:** [GitHub](https://github.com/Mohammad-Faiz-Cloud-Engineer/YouTube-Downloader)

---

## Features

- Video downloads: 144p up to 4K
- Audio extraction as MP3 (320kbps)
- Playlist support
- Real-time progress tracking
- Auto cleanup of temporary files after download

---

## Running on Hugging Face Spaces

This Space uses the **Docker SDK**. It runs automatically — no setup needed on your end. Just use the interface above.

> ⚠️ High-quality downloads (720p+) require FFmpeg, which is pre-installed in the Docker image.

---

## Self-Hosting

### Docker (Recommended)

```bash
git clone https://github.com/Mohammad-Faiz-Cloud-Engineer/YouTube-Downloader.git
cd YouTube-Downloader
docker-compose up -d
```

App runs at `http://localhost:3000`

```bash
docker-compose logs -f   # stream logs
docker-compose down      # stop
docker-compose restart   # restart
```

### Manual

**Requirements:** Node.js v14+, npm, FFmpeg

```bash
git clone https://github.com/Mohammad-Faiz-Cloud-Engineer/YouTube-Downloader.git
cd YouTube-Downloader
npm install
```

**Install FFmpeg:**

| OS | Command |
|---|---|
| Ubuntu/Debian | `sudo apt update && sudo apt install ffmpeg -y` |
| macOS | `brew install ffmpeg` |
| Windows | [Download from ffmpeg.org](https://ffmpeg.org/download.html), extract, add to PATH |

```bash
ffmpeg -version  # verify
npm start        # then open http://localhost:3000
```

---

## API Reference

| Endpoint | Method | Body | Returns |
|---|---|---|---|
| `/api/info` | POST | `{ url }` | Video metadata, thumbnail, available qualities |
| `/api/download/video` | POST | `{ url, quality }` | Video file stream |
| `/api/download/audio` | POST | `{ url }` | MP3 file stream |
| `/api/download/playlist` | POST | `{ url, quality }` | Download status and count |

**Environment variable:** `PORT` (default: `3000`)

---

## Project Structure

```
YouTube-Downloader/
├── server.js
├── public/
│   ├── index.html
│   ├── script.js
│   └── style.css
├── downloads/
├── Dockerfile
├── docker-compose.yml
└── package.json
```

---

## Security

- Inputs validated before processing
- File paths sanitized against directory traversal
- Temp files cleaned up automatically
- No sensitive data logged

---

## License

MIT — pull requests welcome. Open an issue first for major changes.
