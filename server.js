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
                `https://www.youtube.com/playlist?list=${playlistId}`
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
                thumbnail: 'https://i.ytimg.com/vi/default/hqdefault.jpg'
            });
        }

        const jsonOutput = await execYtdl(['--dump-json', '--no-playlist', url]);
        const videoData = JSON.parse(jsonOutput);

        const formatsOutput = await execYtdl(['--list-formats', '--no-playlist', url]);
        
        const qualities = [];
        const lines = formatsOutput.split('\n');
        const seenHeights = new Set();
        
        for (const line of lines) {
            const match = line.match(/(\d+)\s+(\w+)\s+(\d+x\d+)/);
            if (match && match[2] === 'mp4') {
                const height = parseInt(match[3].split('x')[1], 10);
                if (!seenHeights.has(height)) {
                    seenHeights.add(height);
                    qualities.push({
                        formatId: match[1],
                        resolution: match[3],
                        height: height
                    });
                }
            }
        }
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

        // Use the selected quality format with best audio
        // Format: video[format_id]+bestaudio/best ensures high quality video with audio
        const formatString = `${quality}+bestaudio[ext=m4a]/bestaudio`;
        
        await execYtdl([
            '-f', formatString,
            '--merge-output-format', 'mp4',
            '--no-check-certificate',
            '--no-playlist',
            '--no-warnings',
            '-o', outputPath,
            url
        ]);

        let finalFile = '';
        let finalPath = '';
        
        const downloadedFiles = fs.readdirSync(DOWNLOADS_DIR).filter(f => !f.endsWith('.part') && !f.endsWith('.temp'));
        
        for (const f of downloadedFiles) {
            if (f.includes(title)) {
                const filePath = path.join(DOWNLOADS_DIR, f);
                const ext = path.extname(f).toLowerCase();
                
                if (ext === '.mp4') {
                    finalFile = f;
                    finalPath = filePath;
                    break;
                } else if (ext === '.mkv' || ext === '.webm') {
                    // Rename non-mp4 to mp4
                    const cleanName = `${title}.mp4`;
                    const newPath = path.join(DOWNLOADS_DIR, cleanName);
                    if (!fs.existsSync(newPath)) {
                        fs.renameSync(filePath, newPath);
                    }
                    finalFile = cleanName;
                    finalPath = newPath;
                    break;
                }
            }
        }

        if (!finalPath || !fs.existsSync(finalPath)) {
            return res.status(400).json({ error: 'Download failed - file not found' });
        }

        res.setHeader('Content-Disposition', `attachment; filename="${finalFile}"`);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Cache-Control', 'no-cache');
        
        const fileStream = fs.createReadStream(finalPath);
        
        fileStream.on('error', (streamError) => {
            cleanupFile(finalPath);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Stream error occurred' });
            }
        });
        
        fileStream.on('close', () => {
            cleanupFile(finalPath);
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

        res.setHeader('Content-Disposition', `attachment; filename="${actualFile}"`);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-cache');
        
        res.download(actualPath, actualFile, (downloadError) => {
            if (downloadError && !res.headersSent) {
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
        const formatStr = `${quality}+bestaudio[ext=m4a]/bestaudio`;

        await execYtdl([
            '-f', formatStr,
            '--merge-output-format', 'mp4',
            '--yes-playlist',
            '--no-check-certificate',
            '--no-warnings',
            '-o', path.join(DOWNLOADS_DIR, '%(title)s.%(ext)s'),
            `https://www.youtube.com/playlist?list=${playlistId}`
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
    // Server started successfully
});
