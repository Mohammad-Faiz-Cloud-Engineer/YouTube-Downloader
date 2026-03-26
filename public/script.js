/**
 * YouTube Downloader - Client Side Script
 * Creator & Author: Mohammad Faiz
 * Repository: https://github.com/Mohammad-Faiz-Cloud-Engineer/YouTube-Downloader
 */

// Constants
const API_ENDPOINTS = {
    INFO: '/api/info',
    DOWNLOAD_VIDEO: '/api/download/video',
    DOWNLOAD_AUDIO: '/api/download/audio',
    DOWNLOAD_PLAYLIST: '/api/download/playlist'
};

const HTTP_HEADERS = {
    CONTENT_TYPE: 'Content-Type',
    CONTENT_DISPOSITION: 'Content-Disposition'
};

const ERROR_MESSAGES = {
    NO_URL: 'Please enter a YouTube URL',
    INVALID_URL: 'Please enter a valid YouTube URL',
    FETCH_INFO_FIRST: 'Please fetch video information first',
    INVALID_QUALITY: 'Invalid quality selection',
    DOWNLOAD_FAILED: 'Download failed',
    AUDIO_DOWNLOAD_FAILED: 'Audio download failed',
    PLAYLIST_DOWNLOAD_FAILED: 'Playlist download failed',
    EMPTY_FILE: 'Downloaded file is empty'
};

const AUTO_HIDE_DELAY = 8000;
const CLEANUP_DELAY = 100;
const SUCCESS_DISPLAY_DELAY = 3000;

let currentUrl = '';

/**
 * Display error message to user
 * @param {string} msg - Error message to display
 */
function showError(msg) {
    if (!msg || typeof msg !== 'string') return;
    
    const errorBox = document.getElementById('errorBox');
    if (!errorBox) return;
    
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
    
    // Auto-hide after 8 seconds
    setTimeout(() => {
        errorBox.style.display = 'none';
    }, AUTO_HIDE_DELAY);
}

/**
 * Hide error message
 */
function hideError() {
    const errorBox = document.getElementById('errorBox');
    if (errorBox) {
        errorBox.style.display = 'none';
    }
}

/**
 * Show or hide progress indicator
 * @param {boolean} show - Whether to show progress
 */
function showProgress(show) {
    const progressBox = document.getElementById('progressBox');
    if (progressBox) {
        progressBox.style.display = show ? 'block' : 'none';
    }
}

/**
 * Update progress bar and text
 * @param {number} percent - Progress percentage (0-100)
 * @param {string} text - Progress text to display
 */
function updateProgress(percent, text) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const progressPercent = document.getElementById('progressPercent');
    
    if (progressFill) {
        progressFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
    if (progressText && text) {
        progressText.textContent = text;
    }
    if (progressPercent) {
        progressPercent.textContent = `${Math.min(100, Math.max(0, percent))}%`;
    }
}

/**
 * Format duration in seconds to readable time string
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration (HH:MM:SS or MM:SS)
 */
function formatDuration(seconds) {
    if (!seconds || typeof seconds !== 'number' || seconds < 0) return '0:00';
    
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Switch between video and audio tabs
 * @param {Event} e - Click event
 * @param {string} tab - Tab name to switch to
 */
function switchTab(e, tab) {
    if (!tab || typeof tab !== 'string') return;
    
    // Remove active class from all tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Remove active class from all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Add active class to clicked tab
    if (e && e.target) {
        e.target.classList.add('active');
    }
    
    // Show selected tab content
    const tabContent = document.getElementById(`${tab}Tab`);
    if (tabContent) {
        tabContent.classList.add('active');
    }
}

/**
 * Sanitize and escape HTML to prevent XSS
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function escapeHtml(str) {
    if (!str || typeof str !== 'string') return '';
    
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Fetch video information from YouTube URL
 */
async function getVideoInfo() {
    const urlInput = document.getElementById('urlInput');
    if (!urlInput) return;
    
    const url = urlInput.value.trim();
    
    if (!url) {
        showError(ERROR_MESSAGES.NO_URL);
        return;
    }
    
    // Basic URL validation
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
        showError(ERROR_MESSAGES.INVALID_URL);
        return;
    }

    hideError();
    showProgress(true);
    updateProgress(10, 'Fetching video info...');
    
    const btn = document.getElementById('getInfoBtn');
    if (!btn) return;
    
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Loading...';

    try {
        const response = await fetch(API_ENDPOINTS.INFO, {
            method: 'POST',
            headers: { [HTTP_HEADERS.CONTENT_TYPE]: 'application/json' },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }

        currentUrl = url;

        // Update video information with sanitized data
        const videoTitle = document.getElementById('videoTitle');
        const videoThumbnail = document.getElementById('videoThumbnail');
        const videoChannel = document.getElementById('videoChannel');
        const videoDuration = document.getElementById('videoDuration');
        
        if (videoTitle) {
            videoTitle.textContent = data.title || 'Unknown Title';
        }
        
        if (videoThumbnail) {
            videoThumbnail.src = data.thumbnail || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="240" height="135" viewBox="0 0 240 135"><rect fill="%2312121a" width="240" height="135"/><text fill="%236b7280" font-size="48" x="50%" y="50%" text-anchor="middle">▶</text></svg>';
            videoThumbnail.alt = `Thumbnail for ${data.title || 'video'}`;
        }
        
        if (videoChannel) {
            videoChannel.textContent = data.uploader || 'Unknown';
        }
        
        if (videoDuration) {
            videoDuration.textContent = formatDuration(data.duration);
        }

        // Populate quality options
        const qualityChips = document.getElementById('qualityChips');
        if (qualityChips) {
            qualityChips.innerHTML = '';
            
            if (data.qualities && Array.isArray(data.qualities) && data.qualities.length > 0) {
                data.qualities.forEach(q => {
                    if (!q || !q.formatId || !q.height) return;
                    
                    const listItem = document.createElement('div');
                    listItem.className = 'quality-item';
                    
                    const qualityLabel = `${q.height}p`;
                    const resolutionText = escapeHtml(q.resolution || 'Unknown');
                    
                    listItem.innerHTML = `
                        <div class="quality-info">
                            <span class="quality-label">${escapeHtml(qualityLabel)}</span>
                            <span class="quality-resolution">${resolutionText}</span>
                        </div>
                        <button class="btn btn-primary btn-small quality-download-btn" data-format="${escapeHtml(q.formatId)}">Download</button>
                    `;
                    
                    const downloadBtn = listItem.querySelector('.quality-download-btn');
                    if (downloadBtn) {
                        downloadBtn.addEventListener('click', () => downloadVideo(q.formatId));
                    }
                    
                    qualityChips.appendChild(listItem);
                });
            } else {
                qualityChips.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No quality options available</p>';
            }
        }

        // Handle playlist
        const playlistBadge = document.getElementById('playlistBadge');
        const playlistCount = document.getElementById('playlistCount');
        const playlistCard = document.getElementById('playlistCard');
        
        if (data.isPlaylist) {
            if (playlistBadge) playlistBadge.style.display = 'inline-flex';
            if (playlistCount) playlistCount.textContent = data.playlistCount || data.videos?.length || 0;
            if (playlistCard) playlistCard.style.display = 'block';
            
            const playlistChips = document.getElementById('playlistChips');
            if (playlistChips) {
                playlistChips.innerHTML = '';
                
                if (data.qualities && Array.isArray(data.qualities) && data.qualities.length > 0) {
                    data.qualities.forEach(q => {
                        if (!q || !q.formatId || !q.height) return;
                        
                        const listItem = document.createElement('div');
                        listItem.className = 'quality-item';
                        
                        const qualityLabel = `${q.height}p`;
                        const resolutionText = escapeHtml(q.resolution || 'Unknown');
                        
                        listItem.innerHTML = `
                            <div class="quality-info">
                                <span class="quality-label">${escapeHtml(qualityLabel)}</span>
                                <span class="quality-resolution">${resolutionText}</span>
                            </div>
                            <button class="btn btn-primary btn-small quality-download-btn" data-format="${escapeHtml(q.formatId)}">Download Playlist</button>
                        `;
                        
                        const downloadBtn = listItem.querySelector('.quality-download-btn');
                        if (downloadBtn) {
                            downloadBtn.addEventListener('click', () => downloadPlaylist(q.formatId));
                        }
                        
                        playlistChips.appendChild(listItem);
                    });
                }
            }
        } else {
            if (playlistBadge) playlistBadge.style.display = 'none';
            if (playlistCard) playlistCard.style.display = 'none';
        }

        const resultSection = document.getElementById('resultSection');
        if (resultSection) {
            resultSection.style.display = 'block';
        }
        
        updateProgress(100, 'Ready!');

    } catch (err) {
        showError(err.message || ERROR_MESSAGES.FETCH_INFO_FIRST);
    } finally {
        showProgress(false);
        btn.disabled = false;
        btn.innerHTML = 'Get Video';
    }
}

/**
 * Download video in selected quality
 * @param {string} quality - Format ID for quality
 */
async function downloadVideo(quality) {
    if (!currentUrl) {
        showError(ERROR_MESSAGES.FETCH_INFO_FIRST);
        return;
    }
    
    if (!quality || typeof quality !== 'string') {
        showError(ERROR_MESSAGES.INVALID_QUALITY);
        return;
    }
    
    showProgress(true);
    updateProgress(5, 'Starting download...');

    try {
        const response = await fetch(API_ENDPOINTS.DOWNLOAD_VIDEO, {
            method: 'POST',
            headers: { [HTTP_HEADERS.CONTENT_TYPE]: 'application/json' },
            body: JSON.stringify({ url: currentUrl, quality })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: ERROR_MESSAGES.DOWNLOAD_FAILED }));
            throw new Error(err.error || ERROR_MESSAGES.DOWNLOAD_FAILED);
        }

        updateProgress(50, 'Downloading...');

        const blob = await response.blob();
        
        if (!blob || blob.size === 0) {
            throw new Error(ERROR_MESSAGES.EMPTY_FILE);
        }
        
        const url = window.URL.createObjectURL(blob);
        
        // Extract filename from Content-Disposition header
        const contentDisposition = response.headers.get(HTTP_HEADERS.CONTENT_DISPOSITION);
        let filename = `video_${quality}.mp4`;
        
        if (contentDisposition && contentDisposition.includes('filename=')) {
            const match = contentDisposition.match(/filename="?([^";]+)"?/);
            if (match && match[1]) {
                filename = match[1];
            }
        }
        
        // Create download link and trigger download
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, CLEANUP_DELAY);

        updateProgress(100, 'Download complete!');
        setTimeout(() => showProgress(false), SUCCESS_DISPLAY_DELAY);

    } catch (err) {
        showError(err.message || ERROR_MESSAGES.DOWNLOAD_FAILED);
        showProgress(false);
    }
}

/**
 * Download audio as MP3
 */
async function downloadAudio() {
    if (!currentUrl) {
        showError(ERROR_MESSAGES.FETCH_INFO_FIRST);
        return;
    }
    
    showProgress(true);
    updateProgress(5, 'Converting to MP3...');

    try {
        const response = await fetch(API_ENDPOINTS.DOWNLOAD_AUDIO, {
            method: 'POST',
            headers: { [HTTP_HEADERS.CONTENT_TYPE]: 'application/json' },
            body: JSON.stringify({ url: currentUrl })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: ERROR_MESSAGES.DOWNLOAD_FAILED }));
            throw new Error(err.error || ERROR_MESSAGES.DOWNLOAD_FAILED);
        }

        updateProgress(50, 'Downloading...');

        const blob = await response.blob();
        
        if (!blob || blob.size === 0) {
            throw new Error(ERROR_MESSAGES.EMPTY_FILE);
        }
        
        const url = window.URL.createObjectURL(blob);
        
        // Extract filename from Content-Disposition header
        const contentDisposition = response.headers.get(HTTP_HEADERS.CONTENT_DISPOSITION);
        let filename = 'audio.mp3';
        
        if (contentDisposition && contentDisposition.includes('filename=')) {
            const match = contentDisposition.match(/filename="?([^";]+)"?/);
            if (match && match[1]) {
                filename = match[1];
            }
        }
        
        // Create download link and trigger download
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, CLEANUP_DELAY);

        updateProgress(100, 'Download complete!');
        setTimeout(() => showProgress(false), SUCCESS_DISPLAY_DELAY);

    } catch (err) {
        showError(err.message || ERROR_MESSAGES.AUDIO_DOWNLOAD_FAILED);
        showProgress(false);
    }
}

/**
 * Download entire playlist in selected quality
 * @param {string} quality - Format ID for quality
 */
async function downloadPlaylist(quality) {
    if (!currentUrl) {
        showError(ERROR_MESSAGES.FETCH_INFO_FIRST);
        return;
    }
    
    if (!quality || typeof quality !== 'string') {
        showError(ERROR_MESSAGES.INVALID_QUALITY);
        return;
    }
    
    showProgress(true);
    updateProgress(5, 'Downloading playlist...');

    try {
        const response = await fetch(API_ENDPOINTS.DOWNLOAD_PLAYLIST, {
            method: 'POST',
            headers: { [HTTP_HEADERS.CONTENT_TYPE]: 'application/json' },
            body: JSON.stringify({ url: currentUrl, quality })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: ERROR_MESSAGES.PLAYLIST_DOWNLOAD_FAILED }));
            throw new Error(err.error || ERROR_MESSAGES.PLAYLIST_DOWNLOAD_FAILED);
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        updateProgress(100, `Playlist complete! ${data.count || 0} videos downloaded`);

        if (data.zipFile) {
            const downloadArea = document.getElementById('downloadArea');
            const downloadLink = document.getElementById('downloadLink');
            
            if (downloadArea && downloadLink) {
                downloadLink.href = `/downloads/${encodeURIComponent(data.zipFile)}`;
                downloadLink.download = data.zipFile;
                downloadArea.style.display = 'block';
            }
        }

    } catch (err) {
        showError(err.message || ERROR_MESSAGES.PLAYLIST_DOWNLOAD_FAILED);
    } finally {
        showProgress(false);
    }
}

// Initialize event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    if (urlInput) {
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                getVideoInfo();
            }
        });
    }
});
