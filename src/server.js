const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

const rooms = new Map(); // Store room information

const PORT = 3000;

io.on('connection', (socket) => {
    console.log('Client connected');

    // Create a new room for file transfer
    socket.on('create-room', async () => {
        const roomId = uuidv4();
        rooms.set(roomId, {
            host: socket.id,
            clients: new Set([socket.id])
        });

        // Generate QR code for easy connection
        const qrCode = await QRCode.toDataURL(`fileswift://${roomId}`);
        
        socket.join(roomId);
        socket.emit('room-created', { roomId, qrCode });
    });

    // Join an existing room
    socket.on('join-room', (roomId) => {
        const room = rooms.get(roomId);
        if (room) {
            room.clients.add(socket.id);
            socket.join(roomId);
            socket.emit('room-joined', roomId);
            socket.to(room.host).emit('peer-connected', socket.id);
        } else {
            socket.emit('room-error', 'Room not found');
        }
    });

    // Handle WebRTC signaling
    socket.on('signal', ({ peerId, signal }) => {
        socket.to(peerId).emit('signal', {
            peerId: socket.id,
            signal
        });
    });

    async function getAllFiles(dirPath) {
        const files = [];
        const items = await readdir(dirPath);

        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            const stats = await stat(fullPath);

            if (stats.isDirectory()) {
                files.push(...(await getAllFiles(fullPath)));
            } else {
                files.push({
                    path: fullPath,
                    name: path.relative(dirPath, fullPath),
                    size: stats.size
                });
            }
        }

        return files;
    }

    async function transferFile(sourcePath, destPath, fileSize) {
        await mkdir(path.dirname(destPath), { recursive: true });
        return new Promise((resolve, reject) => {
            const reader = fs.createReadStream(sourcePath);
            const writer = fs.createWriteStream(destPath);
            
            let bytesTransferred = 0;

            reader.on('data', (chunk) => {
                writer.write(chunk);
                bytesTransferred += chunk.length;
                const progress = Math.round((bytesTransferred / fileSize) * 100);
                socket.emit('transfer-progress', progress);
            });

            reader.on('end', () => {
                writer.end();
                resolve();
            });

            reader.on('error', reject);
            writer.on('error', reject);
        });
    }

    socket.on('start-transfer', async (data) => {
        try {
            const { files, destinationPath } = data;
            let totalFiles = [];

            for (const file of files) {
                const stats = await stat(file);
                if (stats.isDirectory()) {
                    const dirFiles = await getAllFiles(file);
                    totalFiles.push(...dirFiles);
                } else {
                    totalFiles.push({
                        path: file,
                        name: path.basename(file),
                        size: stats.size
                    });
                }
            }

            for (const file of totalFiles) {
                const destFilePath = path.join(destinationPath, file.name);
                await transferFile(file.path, destFilePath, file.size);
                socket.emit('file-complete', file.name);
            }

            socket.emit('transfer-complete');
        } catch (error) {
            console.error('Transfer error:', error);
            socket.emit('transfer-error', error.message);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        // Clean up rooms
        for (const [roomId, room] of rooms.entries()) {
            if (room.clients.has(socket.id)) {
                room.clients.delete(socket.id);
                if (room.host === socket.id || room.clients.size === 0) {
                    rooms.delete(roomId);
                }
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
