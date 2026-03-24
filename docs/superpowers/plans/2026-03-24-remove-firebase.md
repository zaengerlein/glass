# Firebase entfernen — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Firebase komplett entfernen, damit die App unabhängig von Pickle's Infrastruktur als reine SQLite/Offline-App läuft.

**Architecture:** Alle Repository-Adapter werden auf SQLite-only vereinfacht. Der AuthService wird zu einem simplen Local-User-Service. Firebase-spezifische Dateien (Cloud Functions, Firestore Converter, Migration Service, Firebase Repositories) werden gelöscht. Das Web Dashboard wird auf API-only-Modus umgestellt.

**Tech Stack:** Electron, SQLite (better-sqlite3), Express, Next.js

**Referenz-Dokumentation:** Die vollständige Firebase-Funktionalität ist in `CODEBASE.md` im Abschnitt "Firebase-Funktionalität (entfernt — Referenz für Reimplementierung)" dokumentiert.

---

### Task 1: Firebase-spezifische Dateien löschen

**Files:**
- Delete: `src/features/common/services/firebaseClient.js`
- Delete: `src/features/common/services/migrationService.js`
- Delete: `src/features/common/repositories/firestoreConverter.js`
- Delete: `src/features/common/repositories/user/firebase.repository.js`
- Delete: `src/features/common/repositories/session/firebase.repository.js`
- Delete: `src/features/common/repositories/preset/firebase.repository.js`
- Delete: `src/features/ask/repositories/firebase.repository.js`
- Delete: `src/features/listen/stt/repositories/firebase.repository.js`
- Delete: `src/features/listen/summary/repositories/firebase.repository.js`
- Delete: `src/features/settings/repositories/firebase.repository.js`
- Delete: `functions/` (gesamtes Verzeichnis)
- Delete: `firebase.json`
- Delete: `.firebaserc`
- Delete: `firestore.indexes.json`
- Delete: `pickleglass_web/utils/firebase.ts`
- Delete: `pickleglass_web/utils/firestore.ts`

- [ ] **Step 1: Firebase Repository-Dateien löschen**

```bash
rm src/features/common/repositories/user/firebase.repository.js
rm src/features/common/repositories/session/firebase.repository.js
rm src/features/common/repositories/preset/firebase.repository.js
rm src/features/ask/repositories/firebase.repository.js
rm src/features/listen/stt/repositories/firebase.repository.js
rm src/features/listen/summary/repositories/firebase.repository.js
rm src/features/settings/repositories/firebase.repository.js
```

- [ ] **Step 2: Firebase Service-Dateien löschen**

```bash
rm src/features/common/services/firebaseClient.js
rm src/features/common/services/migrationService.js
rm src/features/common/repositories/firestoreConverter.js
```

- [ ] **Step 3: Cloud Functions und Config-Dateien löschen**

```bash
rm -rf functions/
rm firebase.json
rm .firebaserc
rm firestore.indexes.json
```

- [ ] **Step 4: Web Dashboard Firebase-Dateien löschen**

```bash
rm pickleglass_web/utils/firebase.ts
rm pickleglass_web/utils/firestore.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete all Firebase-specific files

Removes Firebase repositories, services, Cloud Functions,
config files, and web dashboard Firebase utilities.
Documented in CODEBASE.md for future reimplementation."
```

---

### Task 2: AuthService vereinfachen (SQLite-only)

**Files:**
- Modify: `src/features/common/services/authService.js`

Der AuthService wird von einem Firebase-Auth-Manager zu einem simplen Local-User-Service. Er behält die gleiche öffentliche API (`getCurrentUser()`, `getCurrentUserId()`, `initialize()`, `broadcastUserState()`), aber ohne Firebase-Abhängigkeit.

- [ ] **Step 1: AuthService neu schreiben**

Ersetze den gesamten Inhalt von `src/features/common/services/authService.js` mit:

```javascript
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
```

- [ ] **Step 2: Prüfen dass keine fehlenden Imports bestehen**

```bash
grep -r "require.*authService" src/ --include="*.js" | grep -v node_modules
```

Alle Aufrufer verwenden nur `getCurrentUser()`, `getCurrentUserId()`, `initialize()`, `setAuthService()` und `broadcastUserState()` — diese sind alle im neuen Code vorhanden.

- [ ] **Step 3: Commit**

```bash
git add src/features/common/services/authService.js
git commit -m "refactor: simplify AuthService to local-only mode

Removes Firebase auth, virtual key fetching, migration triggers.
Keeps same public API for compatibility with repository adapters."
```

---

### Task 3: Repository-Adapter auf SQLite-only vereinfachen

**Files:**
- Modify: `src/features/common/repositories/user/index.js`
- Modify: `src/features/common/repositories/session/index.js`
- Modify: `src/features/common/repositories/preset/index.js`
- Modify: `src/features/ask/repositories/index.js`
- Modify: `src/features/listen/stt/repositories/index.js`
- Modify: `src/features/listen/summary/repositories/index.js`
- Modify: `src/features/settings/repositories/index.js`

Alle Adapter entfernen den Firebase-Import und die `getBaseRepository()`-Logik. Sie rufen direkt das SQLite-Repository auf.

- [ ] **Step 1: User Repository Adapter**

Ersetze `src/features/common/repositories/user/index.js`:

```javascript
const sqliteRepository = require('./sqlite.repository');

let authService = null;

function getAuthService() {
    if (!authService) {
        authService = require('../../services/authService');
    }
    return authService;
}

const userRepositoryAdapter = {
    findOrCreate: (user) => {
        return sqliteRepository.findOrCreate(user);
    },

    getById: () => {
        const uid = getAuthService().getCurrentUserId();
        return sqliteRepository.getById(uid);
    },

    update: (updateData) => {
        const uid = getAuthService().getCurrentUserId();
        return sqliteRepository.update({ uid, ...updateData });
    },

    deleteById: () => {
        const uid = getAuthService().getCurrentUserId();
        return sqliteRepository.deleteById(uid);
    }
};

module.exports = {
    ...userRepositoryAdapter
};
```

- [ ] **Step 2: Session Repository Adapter**

Ersetze `src/features/common/repositories/session/index.js`:

```javascript
const sqliteRepository = require('./sqlite.repository');

let authService = null;

function setAuthService(service) {
    authService = service;
}

const sessionRepositoryAdapter = {
    setAuthService,

    getById: (id) => sqliteRepository.getById(id),

    create: (type = 'ask') => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.create(uid, type);
    },

    getAllByUserId: () => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.getAllByUserId(uid);
    },

    updateTitle: (id, title) => sqliteRepository.updateTitle(id, title),

    deleteWithRelatedData: (id) => sqliteRepository.deleteWithRelatedData(id),

    end: (id) => sqliteRepository.end(id),

    updateType: (id, type) => sqliteRepository.updateType(id, type),

    touch: (id) => sqliteRepository.touch(id),

    getOrCreateActive: (requestedType = 'ask') => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.getOrCreateActive(uid, requestedType);
    },

    endAllActiveSessions: () => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.endAllActiveSessions(uid);
    },
};

module.exports = sessionRepositoryAdapter;
```

- [ ] **Step 3: Preset Repository Adapter**

Ersetze `src/features/common/repositories/preset/index.js`:

```javascript
const sqliteRepository = require('./sqlite.repository');
const authService = require('../../services/authService');

const presetRepositoryAdapter = {
    getPresets: () => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.getPresets(uid);
    },

    getPresetTemplates: () => {
        return sqliteRepository.getPresetTemplates();
    },

    create: (options) => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.create({ uid, ...options });
    },

    update: (id, options) => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.update(id, options, uid);
    },

    delete: (id) => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.delete(id, uid);
    },
};

module.exports = presetRepositoryAdapter;
```

- [ ] **Step 4: Ask Repository Adapter**

Ersetze `src/features/ask/repositories/index.js`:

```javascript
const sqliteRepository = require('./sqlite.repository');
const authService = require('../../common/services/authService');

const askRepositoryAdapter = {
    addAiMessage: ({ sessionId, role, content, model }) => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.addAiMessage({ uid, sessionId, role, content, model });
    },
    getAllAiMessagesBySessionId: (sessionId) => {
        return sqliteRepository.getAllAiMessagesBySessionId(sessionId);
    }
};

module.exports = askRepositoryAdapter;
```

- [ ] **Step 5: STT Repository Adapter**

Ersetze `src/features/listen/stt/repositories/index.js`:

```javascript
const sqliteRepository = require('./sqlite.repository');
const authService = require('../../../common/services/authService');

const sttRepositoryAdapter = {
    addTranscript: ({ sessionId, speaker, text }) => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.addTranscript({ uid, sessionId, speaker, text });
    },
    getAllTranscriptsBySessionId: (sessionId) => {
        return sqliteRepository.getAllTranscriptsBySessionId(sessionId);
    }
};

module.exports = sttRepositoryAdapter;
```

- [ ] **Step 6: Summary Repository Adapter**

Ersetze `src/features/listen/summary/repositories/index.js`:

```javascript
const sqliteRepository = require('./sqlite.repository');
const authService = require('../../../common/services/authService');

const summaryRepositoryAdapter = {
    saveSummary: ({ sessionId, tldr, text, bullet_json, action_json, model }) => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.saveSummary({ uid, sessionId, tldr, text, bullet_json, action_json, model });
    },
    getSummaryBySessionId: (sessionId) => {
        return sqliteRepository.getSummaryBySessionId(sessionId);
    }
};

module.exports = summaryRepositoryAdapter;
```

- [ ] **Step 7: Settings Repository Adapter**

Ersetze `src/features/settings/repositories/index.js`:

```javascript
const sqliteRepository = require('./sqlite.repository');
const authService = require('../../common/services/authService');

const settingsRepositoryAdapter = {
    getPresets: () => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.getPresets(uid);
    },

    getPresetTemplates: () => {
        return sqliteRepository.getPresetTemplates();
    },

    createPreset: (options) => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.createPreset({ uid, ...options });
    },

    updatePreset: (id, options) => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.updatePreset(id, options, uid);
    },

    deletePreset: (id) => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.deletePreset(id, uid);
    },

    getAutoUpdate: () => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.getAutoUpdate(uid);
    },

    setAutoUpdate: (isEnabled) => {
        const uid = authService.getCurrentUserId();
        return sqliteRepository.setAutoUpdate(uid, isEnabled);
    },
};

module.exports = settingsRepositoryAdapter;
```

- [ ] **Step 8: Commit**

```bash
git add src/features/common/repositories/user/index.js \
        src/features/common/repositories/session/index.js \
        src/features/common/repositories/preset/index.js \
        src/features/ask/repositories/index.js \
        src/features/listen/stt/repositories/index.js \
        src/features/listen/summary/repositories/index.js \
        src/features/settings/repositories/index.js
git commit -m "refactor: simplify all repository adapters to SQLite-only

Removes Firebase routing logic from all 7 repository adapters.
Each adapter now directly delegates to its SQLite repository."
```

---

### Task 4: Electron Main Process bereinigen

**Files:**
- Modify: `src/index.js`

- [ ] **Step 1: Firebase-Import und -Initialisierung entfernen**

In `src/index.js`:
- Lösche Zeile 17: `const { initializeFirebase } = require('./features/common/services/firebaseClient');`
- Lösche Zeile 186: `initializeFirebase();`

- [ ] **Step 2: Deep Link Auth-Callback entfernen**

In `src/index.js`:
- Ersetze im `switch(action)` Block (ca. Zeile 472-476) den `case 'login':` und `case 'auth-success':` Block:

```javascript
            case 'login':
            case 'auth-success':
                // Firebase auth removed — ignore auth deep links
                console.log('[Custom URL] Auth deep links disabled (Firebase removed).');
                break;
```

- Lösche die gesamte `handleFirebaseAuthCallback` Funktion (Zeilen 498-562).

- [ ] **Step 3: Commit**

```bash
git add src/index.js
git commit -m "refactor: remove Firebase init and auth callback from main process"
```

---

### Task 5: Web Dashboard — API-Schicht bereinigen

**Files:**
- Modify: `pickleglass_web/utils/api.ts`
- Modify: `pickleglass_web/utils/auth.ts`

- [ ] **Step 1: api.ts bereinigen**

Ersetze den gesamten Inhalt von `pickleglass_web/utils/api.ts`. Entferne alle Firebase/Firestore-Imports, `isFirebaseMode()`-Checks, Converter-Funktionen und Firestore-Branches. Behalte nur die API-Call-Logik (else-Branches):

```typescript
export interface UserProfile {
  uid: string;
  display_name: string;
  email: string;
}

export interface Session {
  id: string;
  uid: string;
  title: string;
  session_type: string;
  started_at: number;
  ended_at?: number;
  sync_state: 'clean' | 'dirty';
  updated_at: number;
}

export interface Transcript {
  id: string;
  session_id: string;
  start_at: number;
  end_at?: number;
  speaker?: string;
  text: string;
  lang?: string;
  created_at: number;
  sync_state: 'clean' | 'dirty';
}

export interface AiMessage {
  id: string;
  session_id: string;
  sent_at: number;
  role: 'user' | 'assistant';
  content: string;
  tokens?: number;
  model?: string;
  created_at: number;
  sync_state: 'clean' | 'dirty';
}

export interface Summary {
  session_id: string;
  generated_at: number;
  model?: string;
  text: string;
  tldr: string;
  bullet_json: string;
  action_json: string;
  tokens_used?: number;
  updated_at: number;
  sync_state: 'clean' | 'dirty';
}

export interface PromptPreset {
  id: string;
  uid: string;
  title: string;
  prompt: string;
  is_default: 0 | 1;
  created_at: number;
  sync_state: 'clean' | 'dirty';
}

export interface SessionDetails {
    session: Session;
    transcripts: Transcript[];
    ai_messages: AiMessage[];
    summary: Summary | null;
}

let API_ORIGIN = process.env.NODE_ENV === 'development'
  ? 'http://localhost:9001'
  : '';

const loadRuntimeConfig = async (): Promise<string | null> => {
  try {
    const response = await fetch('/runtime-config.json');
    if (response.ok) {
      const config = await response.json();
      console.log('Runtime config loaded:', config);
      return config.API_URL;
    }
  } catch (error) {
    console.log('Failed to load runtime config:', error);
  }
  return null;
};

let apiUrlInitialized = false;
let initializationPromise: Promise<void> | null = null;

const initializeApiUrl = async () => {
  if (apiUrlInitialized) return;

  const runtimeUrl = await loadRuntimeConfig();
  if (runtimeUrl) {
    API_ORIGIN = runtimeUrl;
    apiUrlInitialized = true;
    return;
  }

  console.log('Using fallback API URL:', API_ORIGIN);
  apiUrlInitialized = true;
};

if (typeof window !== 'undefined') {
  initializationPromise = initializeApiUrl();
}

const userInfoListeners: Array<(userInfo: UserProfile | null) => void> = [];

export const getUserInfo = (): UserProfile | null => {
  if (typeof window === 'undefined') return null;

  const storedUserInfo = localStorage.getItem('pickleglass_user');
  if (storedUserInfo) {
    try {
      return JSON.parse(storedUserInfo);
    } catch (error) {
      console.error('Failed to parse user info:', error);
      localStorage.removeItem('pickleglass_user');
    }
  }
  return null;
};

export const setUserInfo = (userInfo: UserProfile | null, skipEvents: boolean = false) => {
  if (typeof window === 'undefined') return;

  if (userInfo) {
    localStorage.setItem('pickleglass_user', JSON.stringify(userInfo));
  } else {
    localStorage.removeItem('pickleglass_user');
  }

  if (!skipEvents) {
    userInfoListeners.forEach(listener => listener(userInfo));
    window.dispatchEvent(new Event('userInfoChanged'));
  }
};

export const onUserInfoChange = (listener: (userInfo: UserProfile | null) => void) => {
  userInfoListeners.push(listener);

  return () => {
    const index = userInfoListeners.indexOf(listener);
    if (index > -1) {
      userInfoListeners.splice(index, 1);
    }
  };
};

export const getApiHeaders = (): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const userInfo = getUserInfo();
  if (userInfo?.uid) {
    headers['X-User-ID'] = userInfo.uid;
  }

  return headers;
};

export const apiCall = async (path: string, options: RequestInit = {}) => {
  if (!apiUrlInitialized && initializationPromise) {
    await initializationPromise;
  }

  if (!apiUrlInitialized) {
    await initializeApiUrl();
  }

  const url = `${API_ORIGIN}${path}`;

  const defaultOpts: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...getApiHeaders(),
      ...(options.headers || {}),
    },
    ...options,
  };
  return fetch(url, defaultOpts);
};

export const searchConversations = async (query: string): Promise<Session[]> => {
  if (!query.trim()) return [];
  const response = await apiCall(`/api/conversations/search?q=${encodeURIComponent(query)}`, { method: 'GET' });
  if (!response.ok) throw new Error('Failed to search conversations');
  return response.json();
};

export const getSessions = async (): Promise<Session[]> => {
  const response = await apiCall(`/api/conversations`, { method: 'GET' });
  if (!response.ok) throw new Error('Failed to fetch sessions');
  return response.json();
};

export const getSessionDetails = async (sessionId: string): Promise<SessionDetails> => {
  const response = await apiCall(`/api/conversations/${sessionId}`, { method: 'GET' });
  if (!response.ok) throw new Error('Failed to fetch session details');
  return response.json();
};

export const createSession = async (title?: string): Promise<{ id: string }> => {
  const response = await apiCall(`/api/conversations`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw new Error('Failed to create session');
  return response.json();
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  const response = await apiCall(`/api/conversations/${sessionId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete session');
};

export const getUserProfile = async (): Promise<UserProfile> => {
  const response = await apiCall(`/api/user/profile`, { method: 'GET' });
  if (!response.ok) throw new Error('Failed to fetch user profile');
  return response.json();
};

export const updateUserProfile = async (data: { displayName: string }): Promise<void> => {
  const response = await apiCall(`/api/user/profile`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update user profile');
};

export const findOrCreateUser = async (user: UserProfile): Promise<UserProfile> => {
  const response = await apiCall(`/api/user/find-or-create`, {
    method: 'POST',
    body: JSON.stringify(user),
  });
  if (!response.ok) throw new Error('Failed to find or create user');
  return response.json();
};

export const saveApiKey = async (apiKey: string): Promise<void> => {
  const response = await apiCall(`/api/user/api-key`, {
    method: 'POST',
    body: JSON.stringify({ apiKey }),
  });
  if (!response.ok) throw new Error('Failed to save API key');
};

export const checkApiKeyStatus = async (): Promise<{ hasApiKey: boolean }> => {
  const response = await apiCall(`/api/user/api-key-status`, { method: 'GET' });
  if (!response.ok) throw new Error('Failed to check API key status');
  return response.json();
};

export const deleteAccount = async (): Promise<void> => {
  const response = await apiCall(`/api/user/profile`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete account');
};

export const getPresets = async (): Promise<PromptPreset[]> => {
  const response = await apiCall(`/api/presets`, { method: 'GET' });
  if (!response.ok) throw new Error('Failed to fetch presets');
  return response.json();
};

export const createPreset = async (data: { title: string, prompt: string }): Promise<{ id: string }> => {
  const response = await apiCall(`/api/presets`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create preset');
  return response.json();
};

export const updatePreset = async (id: string, data: { title: string, prompt: string }): Promise<void> => {
  const response = await apiCall(`/api/presets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update preset: ${response.status} ${errorText}`);
  }
};

export const deletePreset = async (id: string): Promise<void> => {
  const response = await apiCall(`/api/presets/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete preset');
};

export interface BatchData {
    profile?: UserProfile;
    presets?: PromptPreset[];
    sessions?: Session[];
}

export const getBatchData = async (includes: ('profile' | 'presets' | 'sessions')[]): Promise<BatchData> => {
  const response = await apiCall(`/api/user/batch?include=${includes.join(',')}`, { method: 'GET' });
  if (!response.ok) throw new Error('Failed to fetch batch data');
  return response.json();
};

export const logout = async () => {
  setUserInfo(null);
  localStorage.removeItem('openai_api_key');
  localStorage.removeItem('user_info');
  window.location.href = '/login';
};
```

- [ ] **Step 2: auth.ts bereinigen**

Ersetze `pickleglass_web/utils/auth.ts`:

```typescript
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserProfile, setUserInfo } from './api'

const defaultLocalUser: UserProfile = {
  uid: 'default_user',
  display_name: 'Local User',
  email: '',
};

export const useAuth = () => {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mode] = useState<'local'>('local')

  useEffect(() => {
    setUser(defaultLocalUser);
    setUserInfo(defaultLocalUser);
    setIsLoading(false);
  }, [])

  return { user, isLoading, mode }
}

export const useRedirectIfNotAuth = () => {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Local-only mode: no redirect needed
  }, [user, isLoading, router])

  return user
}
```

- [ ] **Step 3: Commit**

```bash
git add pickleglass_web/utils/api.ts pickleglass_web/utils/auth.ts
git commit -m "refactor: remove Firebase from web dashboard API and auth layers

All API functions now use local Express backend only.
Auth hook returns local default user immediately."
```

---

### Task 6: Web Dashboard — Login-Seite vereinfachen

**Files:**
- Modify: `pickleglass_web/app/login/page.tsx`

- [ ] **Step 1: Login-Seite auf Local-Only umstellen**

Ersetze `pickleglass_web/app/login/page.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    // In local-only mode, redirect directly to settings
    router.push('/settings')
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Glass</h1>
        <p className="text-gray-600 mt-2">Redirecting...</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add pickleglass_web/app/login/page.tsx
git commit -m "refactor: simplify login page to local-only redirect"
```

---

### Task 7: Firebase-Dependencies aus package.json entfernen

**Files:**
- Modify: `package.json`
- Modify: `pickleglass_web/package.json`

- [ ] **Step 1: Firebase aus Root package.json entfernen**

In `package.json`, lösche diese zwei Zeilen aus `dependencies`:
```
"firebase": "^11.10.0",
"firebase-admin": "^13.4.0",
```

- [ ] **Step 2: Firebase aus Web Dashboard package.json entfernen**

Prüfe `pickleglass_web/package.json` auf Firebase-Dependency und entferne sie falls vorhanden.

- [ ] **Step 3: Lock-Files aktualisieren**

```bash
cd /Users/joe/Projects/glass && npm install
cd /Users/joe/Projects/glass/pickleglass_web && npm install
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json pickleglass_web/package.json pickleglass_web/package-lock.json
git commit -m "chore: remove firebase and firebase-admin dependencies"
```

---

### Task 8: Verifizierung

- [ ] **Step 1: Prüfen dass keine Firebase-Referenzen mehr existieren**

```bash
grep -r "firebase" src/ --include="*.js" -l
grep -r "firebase" pickleglass_web/ --include="*.ts" --include="*.tsx" -l
grep -r "firebaseClient\|initializeFirebase\|getFirestoreInstance\|getFirebaseAuth" src/ --include="*.js" -l
grep -r "migrationService" src/ --include="*.js" -l
```

Erwartetes Ergebnis: Keine Treffer (oder nur Kommentare/Strings in CODEBASE.md).

- [ ] **Step 2: Renderer Build testen**

```bash
cd /Users/joe/Projects/glass && npm run build:renderer
```

Erwartetes Ergebnis: Build erfolgreich ohne Fehler.

- [ ] **Step 3: Web Dashboard Build testen**

```bash
cd /Users/joe/Projects/glass/pickleglass_web && npm run build
```

Erwartetes Ergebnis: Build erfolgreich ohne Fehler.

- [ ] **Step 4: App starten und grundlegende Funktionalität prüfen**

```bash
cd /Users/joe/Projects/glass && npm start
```

Erwartetes Ergebnis: App startet ohne Fehler, Local User wird angezeigt, grundlegende Features (Ask, Listen) funktionieren.

- [ ] **Step 5: Abschluss-Commit**

Falls Korrekturen nötig waren:
```bash
git add -A
git commit -m "fix: resolve remaining Firebase removal issues"
```
