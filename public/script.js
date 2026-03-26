/**
 * YouTube Downloader - Client Side Script
 * Creator & Author: Mohammad Faiz
 * Repository: https://github.com/Mohammad-Faiz-Cloud-Engineer/YouTube-Downloader
 */

let currentUrl = '';

function showError(msg) {
    const errorBox = document.getElementById('errorBox');
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
    setTimeout(() => errorBox.style.display = 'none', 8000);
}

function hideError() {
    document.getElementById('errorBox').style.display = 'none';
}

function showProgress(show) {
    document.getElementById('progressBox').style.display = show ? 'block' : 'none';
}

function updateProgress(percent, text) {
    document.getElementById('progressFill').style.width = percent + '%';
    document.getElementById('progressText').textContent = text;
    document.getElementById('progressPercent').textContent = percent + '%';
}

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    return `${m}:${s.toString().padStart(2,'0')}`;
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(tab + 'Tab').classList.add('active');
}

async function getVideoInfo() {
    const url = document.getElementById('urlInput').value.trim();
    if (!url) {
        showError('Please enter a YouTube URL');
        return;
    }

    hideError();
    showProgress(true);
    updateProgress(10, 'Fetching video info...');
    
    const btn = document.getElementById('getInfoBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Loading...';

    try {
        const response = await fetch('/api/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        currentUrl = url;

        document.getElementById('videoTitle').textContent = data.title;
        document.getElementById('videoThumbnail').src = data.thumbnail || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="240" height="135" viewBox="0 0 240 135"><rect fill="%2312121a" width="240" height="135"/><text fill="%236b7280" font-size="48" x="50%" y="50%" text-anchor="middle">▶</text></svg>';
        document.getElementById('videoChannel').textContent = data.uploader || 'Unknown';
        document.getElementById('videoDuration').textContent = formatDuration(data.duration);

        const qualityChips = document.getElementById('qualityChips');
        qualityChips.innerHTML = '';
        
        if (data.qualities && data.qualities.length > 0) {
            data.qualities.forEach(q => {
                const chip = document.createElement('button');
                chip.className = 'quality-chip';
                chip.textContent = q.resolution;
                chip.onclick = () => downloadVideo(q.formatId);
                qualityChips.appendChild(chip);
            });
        }

        if (data.isPlaylist) {
            document.getElementById('playlistBadge').style.display = 'inline-flex';
            document.getElementById('playlistCount').textContent = data.playlistCount || data.videos?.length || 0;
            document.getElementById('playlistCard').style.display = 'block';
        } else {
            document.getElementById('playlistBadge').style.display = 'none';
            document.getElementById('playlistCard').style.display = 'none';
        }

        document.getElementById('resultSection').style.display = 'block';
        updateProgress(100, 'Ready!');

    } catch (err) {
        showError(err.message);
    } finally {
        showProgress(false);
        btn.disabled = false;
        btn.innerHTML = 'Get Video';
    }
}

async function downloadVideo(quality) {
    if (!currentUrl) return;
    showProgress(true);
    updateProgress(5, 'Starting download...');

    try {
        const response = await fetch('/api/download/video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: currentUrl, quality })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Download failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = `video_${quality}.mp4`;
        if (contentDisposition && contentDisposition.indexOf('filename=') !== -1) {
            const match = contentDisposition.match(/filename="?([^";]+)"?/);
            if (match) filename = match[1];
        }
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        updateProgress(100, 'Download complete!');
        setTimeout(() => showProgress(false), 3000);

    } catch (err) {
        showError(err.message);
        showProgress(false);
    }
}

async function downloadAudio() {
    if (!currentUrl) return;
    showProgress(true);
    updateProgress(5, 'Converting to MP3...');

    try {
        const response = await fetch('/api/download/audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: currentUrl })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Download failed');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'audio.mp3';
        if (contentDisposition && contentDisposition.indexOf('filename=') !== -1) {
            const match = contentDisposition.match(/filename="?([^";]+)"?/);
            if (match) filename = match[1];
        }
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        updateProgress(100, 'Download complete!');
        setTimeout(() => showProgress(false), 3000);

    } catch (err) {
        showError(err.message);
        showProgress(false);
    }
}

async function downloadPlaylist(quality) {
    if (!currentUrl) return;
    showProgress(true);
    updateProgress(5, 'Downloading playlist...');

    try {
        const response = await fetch('/api/download/playlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: currentUrl, quality })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Playlist download failed');
        }

        const data = await response.json();
        updateProgress(100, `Playlist complete! ${data.count} videos downloaded`);

        if (data.zipFile) {
            const downloadArea = document.getElementById('downloadArea');
            const downloadLink = document.getElementById('downloadLink');
            downloadLink.href = `/downloads/${data.zipFile}`;
            downloadLink.download = data.zipFile;
            downloadArea.style.display = 'block';
        }

    } catch (err) {
        showError(err.message);
    } finally {
        showProgress(false);
    }
}

document.getElementById('urlInput').addEventListener('keypress', e => {
    if (e.key === 'Enter') getVideoInfo();
});
