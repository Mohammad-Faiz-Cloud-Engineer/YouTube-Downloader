/**
 * YouTube Downloader
 * Creator & Author: Mohammad Faiz
 * Repository: https://github.com/Mohammad-Faiz-Cloud-Engineer/YouTube-Downloader
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
const YT_DLP_BIN = path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp');
const MAX_TITLE_LENGTH = 100;
const CLEANUP_DELAY = 5000;

// HTTP Headers Constants
const CONTENT_TYPE_VIDEO = 'video/mp4';
const CONTENT_TYPE_AUDIO = 'audio/mpeg';
const HEADER_CONTENT_DISPOSITION = 'Content-Disposition';
const HEADER_CACHE_CONTROL = 'Cache-Control';

// URL Constants
const YOUTUBE_BASE_URL = 'https://www.youtube.com';
const YOUTUBE_PLAYLIST_URL = `${YOUTUBE_BASE_URL}/playlist?list=`;
const YOUTUBE_DEFAULT_THUMBNAIL = 'https://i.ytimg.com/vi/default/hqdefault.jpg';

if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

function getVideoId(url) {
    if (!url || typeof url !== 'string') return null;
    
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
        /^[a-zA-Z0-9_-]{11}$/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

function getPlaylistId(url) {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/list=([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}

function sanitizeFilename(title) {
    if (!title || typeof title !== 'string') return 'video';
    
    // Remove special characters and limit length
    return title
        .trim()
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // Remove invalid filename characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
        .substring(0, MAX_TITLE_LENGTH);
}

function cleanupFile(filepath) {
    try {
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
    } catch (error) {
        // Silent cleanup failure
    }
}

function execYtdl(args) {
    return new Promise((resolve, reject) => {
        if (!Array.isArray(args) || args.length === 0) {
            return reject(new Error('Invalid arguments'));
        }
        
        const proc = spawn(YT_DLP_BIN, args, { stdio: 'pipe' });
        let stdout = '';
        let stderr = '';
        
        proc.stdout.on('data', (data) => { stdout += data; });
        proc.stderr.on('data', (data) => { stderr += data; });
        
        proc.on('close', (code) => {
            if (code === 0) {
                resolve(stdout);
            } else {
                reject(new Error(stderr || `Command failed with code ${code}`));
            }
        });
        
        proc.on('error', reject);
    });
}

app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/info', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'URL is required' });
        }
        
        const videoId = getVideoId(url);
        const playlistId = getPlaylistId(url);

        if (!videoId && !playlistId) {
            return res.status(400).json({ error: 'Please enter a valid YouTube URL' });
        }

        if (playlistId) {
            const output = await execYtdl([
                '--flat-playlist', 
                '--print', '%(title)s|%(id)s|%(duration)s',
                `${YOUTUBE_PLAYLIST_URL}${playlistId}`
            ]);
            
            const lines = output.trim().split('\n').filter(l => l);
            const videos = lines.slice(0, 10).map(line => {
                const parts = line.split('|');
                return { 
                    id: parts[1] || '', 
                    title: parts[0] || 'Unknown', 
                    duration: parts[2] || '0' 
                };
            });

            return res.json({
                title: `Playlist (${lines.length} videos)`,
                isPlaylist: true,
                playlistCount: lines.length,
                videos: videos,
                thumbnail: YOUTUBE_DEFAULT_THUMBNAIL
            });
        }

        const jsonOutput = await execYtdl(['--dump-json', '--no-playlist', url]);
        const videoData = JSON.parse(jsonOutput);

        // Get all available formats with detailed information
        const qualities = [];
        const seenHeights = new Set();
        
        // Parse formats from JSON for accurate data
        if (videoData.formats && Array.isArray(videoData.formats)) {
            videoData.formats.forEach(format => {
                // Only include video formats with height information
                if (format.height && format.vcodec && format.vcodec !== 'none') {
                    const height = parseInt(format.height, 10);
                    
                    // Skip if we already have this height
                    if (seenHeights.has(height)) return;
                    
                    // Only include reasonable video qualities
                    if (height >= 144 && height <= 4320) {
                        seenHeights.add(height);
                        qualities.push({
                            formatId: format.format_id,
                            resolution: `${format.width || '?'}x${format.height}`,
                            height: height,
                            ext: format.ext || 'mp4',
                            vcodec: format.vcodec,
                            fps: format.fps || 30
                        });
                    }
                }
            });
        }
        
        // Sort by height (highest first)
        qualities.sort((a, b) => b.height - a.height);

        res.json({
            title: videoData.title || 'Unknown',
            thumbnail: videoData.thumbnail || '',
            duration: videoData.duration || 0,
            uploader: videoData.uploader || videoData.channel || 'Unknown',
            isPlaylist: false,
            qualities: qualities
        });

    } catch (error) {
        res.status(400).json({ error: `Failed to fetch video info: ${error.message}` });
    }
});

app.post('/api/download/video', async (req, res) => {
    try {
        const { url, quality } = req.body;
        
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'URL is required' });
        }
        
        if (!quality || typeof quality !== 'string') {
            return res.status(400).json({ error: 'Quality format is required' });
        }
        
        if (!getVideoId(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        const jsonOutput = await execYtdl(['--dump-json', '--no-playlist', url]);
        const videoData = JSON.parse(jsonOutput);
        const title = sanitizeFilename(videoData.title);

        const existingFiles = fs.readdirSync(DOWNLOADS_DIR).filter(f => f.startsWith(title));
        existingFiles.forEach(f => cleanupFile(path.join(DOWNLOADS_DIR, f)));

        const outputPath = path.join(DOWNLOADS_DIR, `${title}.mp4`);

        // Verify the format exists
        const selectedFormat = videoData.formats?.find(f => f.format_id === quality);
        if (!selectedFormat) {
            return res.status(400).json({ error: 'Selected quality format not available' });
        }

        // Use the selected quality format with best audio
        // Format: quality+bestaudio will download and merge if ffmpeg is available
        // If ffmpeg not available, falls back to best combined format
        const formatString = `${quality}+bestaudio/best`;
        
        await execYtdl([
            '-f', formatString,
            '--merge-output-format', 'mp4',
            '--no-check-certificate',
            '--no-playlist',
            '--no-warnings',
            '-o', outputPath,
            url
        ]);

        // Find the downloaded file - could be merged or separate files
        let finalFile = '';
        let finalPath = '';
        
        const downloadedFiles = fs.readdirSync(DOWNLOADS_DIR).filter(f => 
            !f.endsWith('.part') && 
            !f.endsWith('.temp') &&
            !f.endsWith('.ytdl') &&
            f.includes(title)
        );
        
        // Look for the merged file first
        for (const f of downloadedFiles) {
            const filePath = path.join(DOWNLOADS_DIR, f);
            const ext = path.extname(f).toLowerCase();
            
            // Check if it's the main output file (not a fragment)
            if (!f.includes('.f') && (ext === '.mp4' || ext === '.mkv' || ext === '.webm')) {
                finalFile = f;
                finalPath = filePath;
                break;
            }
        }
        
        // If no merged file found, look for video-only file (ffmpeg not available)
        if (!finalPath) {
            for (const f of downloadedFiles) {
                if (f.includes(`.f${quality}.`)) {
                    const filePath = path.join(DOWNLOADS_DIR, f);
                    const ext = path.extname(f).toLowerCase();
                    
                    if (ext === '.mp4' || ext === '.mkv' || ext === '.webm') {
                        // Rename to clean filename
                        const cleanName = `${title}.mp4`;
                        const newPath = path.join(DOWNLOADS_DIR, cleanName);
                        if (!fs.existsSync(newPath)) {
                            fs.renameSync(filePath, newPath);
                        }
                        finalFile = cleanName;
                        finalPath = newPath;
                        
                        // Clean up audio file if exists
                        downloadedFiles.forEach(df => {
                            if (df.includes('.f') && df !== f) {
                                cleanupFile(path.join(DOWNLOADS_DIR, df));
                            }
                        });
                        break;
                    }
                }
            }
        }

        if (!finalPath || !fs.existsSync(finalPath)) {
            return res.status(400).json({ error: 'Download failed - file not found. Please ensure ffmpeg is installed for high-quality downloads.' });
        }

        res.setHeader(HEADER_CONTENT_DISPOSITION, `attachment; filename="${finalFile}"`);
        res.setHeader('Content-Type', CONTENT_TYPE_VIDEO);
        res.setHeader(HEADER_CACHE_CONTROL, 'no-cache');
        
        const fileStream = fs.createReadStream(finalPath);
        
        fileStream.on('error', () => {
            cleanupFile(finalPath);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Stream error occurred' });
            }
        });
        
        fileStream.on('close', () => {
            cleanupFile(finalPath);
            // Clean up any remaining fragment files
            const remainingFiles = fs.readdirSync(DOWNLOADS_DIR).filter(f => f.includes(title) && f.includes('.f'));
            remainingFiles.forEach(f => cleanupFile(path.join(DOWNLOADS_DIR, f)));
        });
        
        fileStream.pipe(res);

    } catch (error) {
        res.status(400).json({ error: `Download failed: ${error.message}` });
    }
});

app.post('/api/download/audio', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'URL is required' });
        }
        
        if (!getVideoId(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        const jsonOutput = await execYtdl(['--dump-json', '--no-playlist', url]);
        const videoData = JSON.parse(jsonOutput);
        const title = sanitizeFilename(videoData.title);

        const filename = `${title}.mp3`;
        const filepath = path.join(DOWNLOADS_DIR, filename);

        try {
            await execYtdl([
                '-x', '--audio-format', 'mp3', '--audio-quality', '0',
                '--no-check-certificate',
                '--no-playlist',
                '--no-warnings',
                '--merge-output-format', 'mp3',
                '-o', filepath,
                url
            ]);
        } catch (conversionError) {
            // Fallback: download best audio format
            await execYtdl([
                '-f', 'bestaudio',
                '--no-check-certificate',
                '--no-playlist',
                '--no-warnings',
                '-o', filepath,
                url
            ]);
        }

        const files = fs.readdirSync(DOWNLOADS_DIR).filter(f => f.startsWith(title) && !f.endsWith('.part'));
        
        if (files.length === 0) {
            return res.status(400).json({ error: 'Audio download failed' });
        }

        let actualFile = files[0];
        let actualPath = path.join(DOWNLOADS_DIR, actualFile);

        const mp3Filename = `${title}.mp3`;
        const mp3Path = path.join(DOWNLOADS_DIR, mp3Filename);
        
        if (!actualFile.endsWith('.mp3')) {
            if (!fs.existsSync(mp3Path)) {
                fs.renameSync(actualPath, mp3Path);
                actualFile = mp3Filename;
                actualPath = mp3Path;
            }
        }

        res.setHeader(HEADER_CONTENT_DISPOSITION, `attachment; filename="${actualFile}"`);
        res.setHeader('Content-Type', CONTENT_TYPE_AUDIO);
        res.setHeader(HEADER_CACHE_CONTROL, 'no-cache');
        
        res.download(actualPath, actualFile, (err) => {
            if (err && !res.headersSent) {
                res.status(500).json({ error: 'Download error occurred' });
            }
            setTimeout(() => cleanupFile(actualPath), CLEANUP_DELAY);
        });

    } catch (error) {
        res.status(400).json({ error: `Audio download failed: ${error.message}` });
    }
});

app.post('/api/download/playlist', async (req, res) => {
    try {
        const { url, quality } = req.body;
        
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'URL is required' });
        }
        
        if (!quality || typeof quality !== 'string') {
            return res.status(400).json({ error: 'Quality format is required' });
        }
        
        const playlistId = getPlaylistId(url);
        
        if (!playlistId) {
            return res.status(400).json({ error: 'Invalid playlist URL' });
        }

        // Use selected quality with best audio for high quality output
        const formatStr = `${quality}+bestaudio/best`;

        await execYtdl([
            '-f', formatStr,
            '--merge-output-format', 'mp4',
            '--yes-playlist',
            '--no-check-certificate',
            '--no-warnings',
            '--recode-video', 'mp4',
            '-o', path.join(DOWNLOADS_DIR, '%(title)s.%(ext)s'),
            `${YOUTUBE_PLAYLIST_URL}${playlistId}`
        ]);

        const files = fs.readdirSync(DOWNLOADS_DIR).filter(f => !f.endsWith('.part') && !f.startsWith('temp_'));
        
        res.json({
            success: true,
            count: files.length,
            message: `Downloaded ${files.length} videos in high quality`
        });

    } catch (error) {
        res.status(400).json({ error: `Playlist download failed: ${error.message}` });
    }
});

app.listen(PORT, () => {
    // Check for ffmpeg availability on startup
    const { exec } = require('child_process');
    exec('ffmpeg -version', (error) => {
        const separator = '='.repeat(60);
        if (error) {
            console.warn(`\n${separator}`);
            console.warn('WARNING: FFmpeg NOT FOUND!');
            console.warn(separator);
            console.warn('High-quality downloads (720p+) will NOT work correctly.');
            console.warn('Users will get low-quality videos instead of HD/4K.');
            console.warn('');
            console.warn('SOLUTION: Install FFmpeg');
            console.warn('Ubuntu/Debian: sudo apt install ffmpeg -y');
            console.warn('macOS: brew install ffmpeg');
            console.warn(`${separator}\n`);
        } else {
            console.info('FFmpeg detected - High-quality downloads enabled');
        }
        console.info(`YouTube Downloader running at http://localhost:${PORT}`);
    });
});