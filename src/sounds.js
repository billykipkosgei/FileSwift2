const { app } = require('electron');
const path = require('path');

class SoundManager {
    constructor() {
        this.sounds = {
            connect: new Audio(path.join(__dirname, 'sounds', 'connect.mp3')),
            transfer: new Audio(path.join(__dirname, 'sounds', 'transfer.mp3')),
            disconnect: new Audio(path.join(__dirname, 'sounds', 'disconnect.mp3'))
        };

        // Set volume for all sounds
        Object.values(this.sounds).forEach(sound => {
            sound.volume = 0.5;
        });
    }

    playConnect() {
        this.sounds.connect.currentTime = 0;
        this.sounds.connect.play();
    }

    playTransfer() {
        this.sounds.transfer.currentTime = 0;
        this.sounds.transfer.play();
    }

    playDisconnect() {
        this.sounds.disconnect.currentTime = 0;
        this.sounds.disconnect.play();
    }
}

const soundManager = new SoundManager();
module.exports = soundManager;
