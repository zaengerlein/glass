const { BrowserWindow } = require('electron');
const encryptionService = require('./encryptionService');
const sessionRepository = require('../repositories/session');

const LOCAL_USER_ID = 'default_user';

class AuthService {
    constructor() {
        this.currentUserId = LOCAL_USER_ID;
        this.currentUserMode = 'local';
        this.currentUser = null;
        this.isInitialized = false;
        this.initializationPromise = null;

        sessionRepository.setAuthService(this);
    }

    async initialize() {
        if (this.isInitialized) return this.initializationPromise;

        this.initializationPromise = (async () => {
            // Clean up zombie sessions from previous runs
            await sessionRepository.endAllActiveSessions();

            // Initialize encryption key for local user
            await encryptionService.initializeKey(LOCAL_USER_ID);

            this.isInitialized = true;
            console.log('[AuthService] Initialized in local-only mode.');
            this.broadcastUserState();
        })();

        return this.initializationPromise;
    }

    broadcastUserState() {
        const userState = this.getCurrentUser();
        console.log('[AuthService] Broadcasting user state:', userState);
        BrowserWindow.getAllWindows().forEach(win => {
            if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
                win.webContents.send('user-state-changed', userState);
            }
        });
    }

    getCurrentUserId() {
        return this.currentUserId;
    }

    getCurrentUser() {
        return {
            uid: LOCAL_USER_ID,
            email: '',
            displayName: 'Local User',
            mode: 'local',
            isLoggedIn: false,
        };
    }
}

const authService = new AuthService();
module.exports = authService;
