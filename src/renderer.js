// Use exposed APIs
const { on: socketOn, emit: socketEmit } = window.socketAPI;
const { selectFiles, selectDirectory, minimizeWindow, maximizeWindow, closeWindow } = window.electronAPI;
const { createPeer } = window.Peer;
const { stat } = window.fsAPI;

let peer = null;
let currentRoom = null;

// Connection UI elements
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomIdInput = document.getElementById('roomIdInput');
const roomInfo = document.getElementById('roomInfo');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const copyRoomId = document.getElementById('copyRoomId');
const qrCodeDiv = document.getElementById('qrCode');
const connectionStatus = document.getElementById('connectionStatus');
const statusMessage = document.getElementById('statusMessage');

// Get audio elements
const connectSound = document.getElementById('connectSound');
const transferSound = document.getElementById('transferSound');
const disconnectSound = document.getElementById('disconnectSound');

// Set volume for all sounds
[connectSound, transferSound, disconnectSound].forEach(sound => {
    sound.volume = 0.5;
});

// Create Room
createRoomBtn.addEventListener('click', () => {
    socketEmit('create-room');
    updateStatus('Creating room...', 'info');
});

// Join Room
joinRoomBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (roomId) {
        socketEmit('join-room', roomId);
        updateStatus('Joining room...', 'info');
    }
});

// Copy Room ID
copyRoomId.addEventListener('click', () => {
    clipboard.writeText(currentRoom);
    updateStatus('Room ID copied to clipboard! 📋', 'success');
});

// Socket event handlers for room management
socketOn('room-created', ({ roomId, qrCode }) => {
    currentRoom = roomId;
    roomIdDisplay.textContent = roomId;
    qrCodeDiv.innerHTML = `<img src="${qrCode}" class="mx-auto">`;
    roomInfo.classList.remove('hidden');
    updateStatus('Room created! Share the Room ID or scan QR code to connect', 'success');
});

socketOn('room-joined', (roomId) => {
    currentRoom = roomId;
    updateStatus('Connected to room! Establishing peer connection...', 'success');
    initiatePeerConnection(false);
});

socketOn('room-error', (error) => {
    updateStatus(`Error: ${error}`, 'error');
});

socketOn('peer-connected', (peerId) => {
    updateStatus('Peer connected! Setting up connection...', 'info');
    initiatePeerConnection(true);
});

// WebRTC peer connection
function initiatePeerConnection(initiator) {
    peer = createPeer({ initiator });

    peer.on('signal', (data) => {
        socketEmit('signal', {
            signal: data,
            peerId: currentRoom
        });
    });

    peer.on('connect', () => {
        updateStatus('Peer connection established! Ready to transfer files ✨', 'success');
        connectSound.currentTime = 0;
        connectSound.play();
    });

    peer.on('data', handleIncomingData);
    peer.on('error', (err) => updateStatus(`Peer error: ${err.message}`, 'error'));
}

socketOn('signal', ({ peerId, signal }) => {
    if (peer) {
        peer.signal(signal);
    }
});

function updateStatus(message, type = 'info') {
    connectionStatus.className = `alert alert-${type} mb-8`;
    statusMessage.textContent = message;
    connectionStatus.classList.remove('hidden');
}

// Handle incoming file data
function handleIncomingData(data) {
    // Implementation for handling incoming file chunks
    // This will be used when receiving files
}

// Window controls
document.querySelector('.minimize-btn').addEventListener('click', minimizeWindow);
document.querySelector('.maximize-btn').addEventListener('click', maximizeWindow);
document.querySelector('.close-btn').addEventListener('click', closeWindow);

// File selection
const dropZone = document.getElementById('dropZone');
const selectFilesBtn = document.getElementById('selectFiles');
const selectedFilesDiv = document.getElementById('selectedFiles');
const selectSavePathBtn = document.getElementById('selectSavePath');
const savePathInput = document.getElementById('savePath');
const transferProgress = document.getElementById('transferProgress');
const transferStatus = document.getElementById('transferStatus');

let selectedFiles = [];

// Drag and drop handling
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-success');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-success');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-success');
    const files = Array.from(e.dataTransfer.files);
    handleSelectedFiles(files);
});

selectFilesBtn.addEventListener('click', async () => {
    const files = await selectFiles();
    if (files) {
        handleSelectedFiles(files);
    }
});

selectSavePathBtn.addEventListener('click', async () => {
    const path = await selectDirectory();
    if (path) {
        savePathInput.value = path;
    }
});

async function handleSelectedFiles(files) {
    selectedFiles = files;
    selectedFilesDiv.innerHTML = '';
    
    for (const file of files) {
        const stats = await new Promise((resolve) => {
            if (typeof file === 'string') {
                fs.stat(file, (err, stats) => resolve(stats));
            } else {
                resolve({ size: file.size, isDirectory: () => false });
            }
        });

        const isDirectory = stats.isDirectory();
        const fileName = typeof file === 'string' ? file.split('\\').pop() : file.name;

        const fileElement = document.createElement('div');
        fileElement.className = 'flex items-center gap-2 mb-2 animate__animated animate__fadeIn';
        fileElement.innerHTML = `
            <span class="text-success">${isDirectory ? '📁' : '📄'}</span>
            <span class="flex-1">${fileName}</span>
            ${!isDirectory ? `<span class="text-sm opacity-70">${formatFileSize(stats.size)}</span>` : ''}
        `;
        selectedFilesDiv.appendChild(fileElement);
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Socket.io event handlers
socketOn('disconnect', () => {
    console.log('Client disconnected');
    disconnectSound.currentTime = 0;
    disconnectSound.play();
});

socket.on('connect', () => {
    console.log('Connected to server');
});

socketOn('transfer-progress', (progress) => {
    transferProgress.classList.remove('hidden');
    const progressBar = document.querySelector('progress');
    progressBar.value = progress;
    transferStatus.textContent = `Transferring: ${progress}%`;
});

socket.on('file-complete', (fileName) => {
    const notification = document.createElement('div');
    notification.className = 'toast toast-end';
    notification.innerHTML = `
        <div class="alert alert-success">
            <span>✅ ${fileName} transferred!</span>
        </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
});

socketOn('transfer-complete', () => {
    transferStatus.textContent = 'Transfer Complete! ✨';
    transferSound.currentTime = 0;
    transferSound.play();
    setTimeout(() => {
        transferProgress.classList.add('hidden');
        transferStatus.textContent = '';
    }, 3000);
});

socket.on('transfer-error', (error) => {
    transferStatus.textContent = `Error: ${error}`;
    transferStatus.classList.add('text-error');
    setTimeout(() => {
        transferProgress.classList.add('hidden');
        transferStatus.textContent = '';
        transferStatus.classList.remove('text-error');
    }, 5000);
});
