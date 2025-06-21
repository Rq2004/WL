document.addEventListener('DOMContentLoaded', () => {
    const cliOutput = document.getElementById('cli-output');
    const releaseContainer = document.getElementById('release-container');
    const pathDisplay = document.getElementById('path-display');
    const downloadBtn = document.getElementById('download-btn');
    const selectedFileInfo = document.getElementById('selected-file-info');
    const canvas = document.getElementById('matrix-bg');
    const ctx = canvas.getContext('2d');

    let selectedFile = null;

    // --- Matrix Background ---
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789@#$%^&*()*&^%+-/~{[|`]}';
    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const drops = Array(Math.floor(columns)).fill(1);

    function drawMatrix() {
        ctx.fillStyle = 'rgba(13, 13, 13, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0, 255, 65, 0.7)';
        ctx.font = `${fontSize}px ${getComputedStyle(document.body).fontFamily}`;

        for (let i = 0; i < drops.length; i++) {
            const text = letters[Math.floor(Math.random() * letters.length)];
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);

            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
    }
    const matrixInterval = setInterval(drawMatrix, 40);

    // --- CLI Output Logger ---
    let logCounter = 0;
    function logToCli(message, type = 'INFO') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.innerHTML = `<span style="color: #888;">[${timestamp}]</span> <span style="color: var(--fg-color);">${escapeHtml(message)}</span>`;
        cliOutput.appendChild(logEntry);
        cliOutput.scrollTop = cliOutput.scrollHeight;
        logCounter++;
        if (logCounter > 200) { // Keep DOM light
            cliOutput.removeChild(cliOutput.firstChild);
        }
    }

    document.addEventListener('mousemove', (e) => {
        // Debounce mouse move logging
        if (Math.random() > 0.98) {
           logToCli(`MOUSE_MOVE (x:${e.clientX}, y:${e.clientY})`);
        }
    });

    document.addEventListener('click', (e) => {
        logToCli(`CLICK (x:${e.clientX}, y:${e.clientY}) on ${e.target.tagName}`);
    });

    async function fetchAnnouncement() {
        logToCli('Fetching system broadcast...');
        try {
            const response = await fetch('https://raw.githubusercontent.com/Rq2004/WL/main/home.txt');
            if (!response.ok) {
                throw new Error(`Broadcast transmission failed. STATUS: ${response.status}`);
            }
            const text = await response.text();
            if (text.trim()) {
                logToCli("--- [ SYSTEM BROADCAST ] ---");
                text.split('\n').forEach(line => {
                    logToCli(`  ${line}`);
                });
                logToCli("----------------------------");
            } else {
                logToCli("No active broadcast.");
            }
        } catch (error) {
            logToCli(`[ERROR] Failed to fetch broadcast: ${error.message}`, 'ERROR');
        }
    }

    // --- Core Logic ---
    async function fetchReleases() {
        logToCli('Connecting to repository: Rq2004/WL');
        try {
            const response = await fetch(`https://api.github.com/repos/Rq2004/WL/releases`);
            if (!response.ok) {
                throw new Error(`Network response error: ${response.status}`);
            }
            const releases = await response.json();
            logToCli(`Success. Found ${releases.length} release packages.`);
            renderReleases(releases);
        } catch (error) {
            logToCli(`[ERROR] Failed to fetch releases: ${error.message}`, 'ERROR');
            releaseContainer.innerHTML = `<div style="color: #ff4d4d;">Error loading releases.</div>`;
        }
    }

    function renderReleases(releases) {
        if (releases.length === 0) {
            releaseContainer.innerHTML = '<div>No releases found.</div>';
            logToCli('No release packages available.');
            return;
        }

        releaseContainer.innerHTML = releases.map(release => `
            <div class="release-item" data-release-id="${release.id}">
                <div class="release-header" data-release-name="${escapeHtml(release.name || release.tag_name)}">
                    <span><span class="arrow">▶</span> ${escapeHtml(release.name || release.tag_name)}</span>
                    <span>${new Date(release.published_at).toLocaleDateString()}</span>
                </div>
                <div class="assets-list">
                    ${release.assets.map(asset => `
                        <div class="asset-item" 
                             data-url="${asset.browser_download_url}" 
                             data-name="${escapeHtml(asset.name)}"
                             data-size="${formatFileSize(asset.size)}">
                            <span>${escapeHtml(asset.name)}</span>
                            <span class="asset-size">${formatFileSize(asset.size)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
        logToCli('Rendered release list.');
        addReleaseEventListeners();
    }
    
    function addReleaseEventListeners() {
        releaseContainer.querySelectorAll('.release-header').forEach(header => {
            header.addEventListener('click', () => toggleRelease(header));
        });

        releaseContainer.querySelectorAll('.asset-item').forEach(item => {
            item.addEventListener('click', () => selectFile(item));
        });
        logToCli('Event listeners attached.');
    }

    function toggleRelease(header) {
        const assetsList = header.nextElementSibling;
        const isExpanded = header.classList.contains('expanded');
        
        // Close all others
        document.querySelectorAll('.release-header.expanded').forEach(h => {
            if (h !== header) {
                // If a file is selected in the closing release, deselect it
                const fileInside = h.nextElementSibling.querySelector('.asset-item.selected');
                if (fileInside) {
                    selectFile(fileInside); // This will call the deselection logic
                }
                logToCli(`Collapsed release: ${h.dataset.releaseName}`);
                h.classList.remove('expanded');
                h.nextElementSibling.style.maxHeight = null;
                 h.querySelector('.arrow').style.transform = 'rotate(0deg)';
            }
        });

        if (isExpanded) {
            // Deselect file if inside the one being collapsed by the user
            const fileInside = assetsList.querySelector('.asset-item.selected');
            if (fileInside) {
                selectFile(fileInside); // This will call the deselection logic
            }
            header.classList.remove('expanded');
            assetsList.style.maxHeight = null;
            header.querySelector('.arrow').style.transform = 'rotate(0deg)';
            pathDisplay.textContent = '/';
            logToCli(`Collapsed release: ${header.dataset.releaseName}`);
        } else {
            header.classList.add('expanded');
            assetsList.style.maxHeight = assetsList.scrollHeight + "px";
            header.querySelector('.arrow').style.transform = 'rotate(90deg)';
            pathDisplay.textContent = `/${header.dataset.releaseName}`;
            logToCli(`Expanded release: ${header.dataset.releaseName}`);
        }
    }

    function selectFile(fileItem) {
        const currentSelected = document.querySelector('.asset-item.selected');
        const expandedHeader = document.querySelector('.release-header.expanded');
        const releaseName = expandedHeader ? expandedHeader.dataset.releaseName : '';

        // Case 1: Clicking the already selected file to deselect it.
        if (currentSelected === fileItem) {
            currentSelected.classList.remove('selected');
            selectedFile = null;
            selectedFileInfo.textContent = '未选择文件';
            downloadBtn.disabled = true;
            logToCli(`Deselected file: ${fileItem.dataset.name}`);
            if (expandedHeader) {
                pathDisplay.textContent = `/${releaseName}`;
            }
            return; // Exit function
        }

        // Case 2: Switching from one file to another, log the deselection first.
        if (currentSelected) {
            logToCli(`Deselected file: ${currentSelected.dataset.name}`);
            currentSelected.classList.remove('selected');
        }

        // Case 3: Selecting a new file (either for the first time, or after switching).
        fileItem.classList.add('selected');
        selectedFile = {
            url: fileItem.dataset.url,
            name: fileItem.dataset.name,
            size: fileItem.dataset.size
        };
        selectedFileInfo.textContent = `[${selectedFile.size}] ${selectedFile.name}`;
        downloadBtn.disabled = false;
        logToCli(`Selected file: ${fileItem.dataset.name}`);
        if (expandedHeader) {
            pathDisplay.textContent = `/${releaseName}/${selectedFile.name}`;
        }
    }

    downloadBtn.addEventListener('click', () => {
        if (selectedFile) {
            logToCli(`Initiating download for ${selectedFile.name}`);
            logToCli(`URL: ${selectedFile.url}`);
            // Using proxy for acceleration
            const proxyUrl = `https://ghproxy.net/${encodeURI(selectedFile.url)}`;
            logToCli(`Accelerated URL: ${proxyUrl}`);
            window.open(proxyUrl, '_blank');
        } else {
            logToCli('[WARNING] Download clicked but no file selected.', 'WARN');
        }
    });

    // --- Utility Functions ---
    function escapeHtml(unsafe) {
        return unsafe.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        if (bytes == 0) return '0 B';
        const exp = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, exp)).toFixed(2)} ${units[exp]}`;
    }
    
    // --- Window Resize ---
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // recalculate columns and reset drops on resize
        const newColumns = canvas.width / fontSize;
        drops.length = Math.floor(newColumns);
        drops.fill(1);
    });

    // --- Initializer ---
    async function initialize() {
        logToCli('System initializing...');
        await fetchAnnouncement();
        await fetchReleases();
        logToCli('System ready. Awaiting user input.');
    }
    initialize();
}); 
