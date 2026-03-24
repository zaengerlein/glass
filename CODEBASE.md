# Glass by Pickle — Codebase-Dokumentation

> **Glass** ist ein Open-Source AI-Assistent, der als "Digital Mind Extension" Bildschirmkontext und Audio in Echtzeit erfasst, um kontextuelle Intelligenz bereitzustellen — z.B. Action Items, Zusammenfassungen und Antworten während Meetings.

---

## Inhaltsverzeichnis

- [Architektur-Überblick](#architektur-überblick)
- [Verzeichnisstruktur](#verzeichnisstruktur)
- [Technologie-Stack](#technologie-stack)
- [Electron Desktop App](#electron-desktop-app)
  - [Main Process](#main-process)
  - [Feature-Architektur](#feature-architektur)
  - [AI Provider System](#ai-provider-system)
  - [Datenbank (SQLite)](#datenbank-sqlite)
  - [Encryption](#encryption)
  - [Lokale AI Services](#lokale-ai-services)
- [Next.js Web Dashboard](#nextjs-web-dashboard)
  - [Routing & Seiten](#routing--seiten)
  - [Komponenten](#komponenten)
  - [State Management](#state-management)
  - [API-Kommunikation](#api-kommunikation)
- [Firebase Backend](#firebase-backend)
  - [Cloud Functions](#cloud-functions)
  - [Firestore-Struktur](#firestore-struktur)
  - [Authentication Flow](#authentication-flow)
- [Daten-Synchronisation](#daten-synchronisation)
- [Sicherheit](#sicherheit)
- [Build & Deployment](#build--deployment)
- [Scripts](#scripts)

---

## Architektur-Überblick

Glass besteht aus drei Hauptkomponenten:

```
┌──────────────────────────────────────────────────────────┐
│                    Electron Desktop App                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │   Ask     │  │  Listen  │  │ Settings │  │ Shortcuts│ │
│  │ (LLM Q&A)│  │  (STT)   │  │          │  │          │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       └──────────────┴─────────────┴──────────────┘       │
│                    Common Services                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ AI Factory│  │  SQLite  │  │ Firebase │  │Encryption│ │
│  │ (Multi-   │  │  Client  │  │  Client  │  │ Service  │ │
│  │ Provider) │  │          │  │          │  │          │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
└──────────────────────────────────────────────────────────┘

┌──────────────────────┐    ┌──────────────────────────────┐
│  Next.js Web Dashboard│    │     Firebase Backend          │
│  (pickleglass_web/)   │    │  ┌────────────────────────┐  │
│  • Activity History   │◄──►│  │ Cloud Functions (Auth) │  │
│  • Personalize        │    │  │ Firestore (Cloud DB)   │  │
│  • Settings/Billing   │    │  │ Hosting                │  │
│  • Login              │    │  └────────────────────────┘  │
└──────────────────────┘    └──────────────────────────────┘
```

**Kernprinzip: Offline-First** — SQLite als primärer lokaler Speicher, Firebase-Sync optional bei Anmeldung.

---

## Verzeichnisstruktur

```
glass/
├── src/                            # Electron App (Hauptanwendung)
│   ├── index.js                    # Main Process Entry Point
│   ├── preload.js                  # Context Bridge (IPC API)
│   ├── bridge/                     # IPC-Kommunikation
│   │   ├── featureBridge.js        #   Feature/Service-Aufrufe
│   │   ├── windowBridge.js         #   Fensterverwaltung
│   │   └── internalBridge.js       #   Interne Kommunikation
│   ├── features/                   # Feature-Module
│   │   ├── ask/                    #   LLM Q&A Feature
│   │   ├── listen/                 #   Audio-Erfassung & Transkription
│   │   │   ├── stt/               #     Speech-to-Text Service
│   │   │   └── summary/           #     Meeting-Zusammenfassungen
│   │   ├── settings/               #   Einstellungsverwaltung
│   │   ├── shortcuts/              #   Tastenkürzel
│   │   └── common/                 #   Gemeinsame Services
│   │       ├── ai/                #     AI Provider Factory
│   │       │   └── providers/     #     Anthropic, OpenAI, Gemini, Deepgram, Ollama, Whisper
│   │       ├── services/          #     Kern-Services
│   │       ├── repositories/      #     Datenzugriff (SQLite + Firebase)
│   │       ├── config/            #     Konfiguration
│   │       ├── prompts/           #     AI-Prompts
│   │       └── utils/             #     Hilfsfunktionen
│   ├── ui/                         # Renderer UI
│   │   ├── app/                   #   Hauptapp-UI
│   │   ├── ask/                   #   Ask-Interface
│   │   ├── listen/                #   Audio/Listen-UI
│   │   │   └── audioCore/         #     Audio-Verarbeitung (AEC)
│   │   ├── settings/              #   Einstellungen-UI
│   │   ├── assets/                #   Third-Party Libs
│   │   └── styles/                #   Stylesheets
│   └── window/                     # Fensterverwaltung
│       ├── windowManager.js
│       ├── windowLayoutManager.js
│       └── smoothMovementManager.js
│
├── pickleglass_web/                # Next.js Web Dashboard
│   ├── app/                       #   App Router Pages
│   ├── components/                #   React-Komponenten
│   ├── utils/                     #   API- & Auth-Utilities
│   ├── backend_node/              #   Express-Server (gebündelt)
│   └── public/                    #   Statische Assets
│
├── functions/                      # Firebase Cloud Functions
│   └── index.js                   #   Auth Callback Handler
│
├── public/                         # Electron App Assets
├── docs/                           # Dokumentation
├── aec/                            # Acoustic Echo Cancellation
├── package.json                    # Root Dependencies (Electron)
├── build.js                        # ESBuild Renderer Config
├── electron-builder.yml            # Electron Build Config
├── firebase.json                   # Firebase Projekt Config
└── .firebaserc                     # Firebase Projekt-ID: pickle-3651a
```

---

## Technologie-Stack

| Bereich | Technologie |
|---------|-------------|
| **Desktop Runtime** | Electron 30.5.1 |
| **Web Framework** | Next.js 14.2 (App Router), React 18, TypeScript 5 |
| **Styling** | Tailwind CSS 3.3 |
| **Lokale DB** | better-sqlite3 (WAL Mode) |
| **Cloud DB** | Firebase Firestore |
| **Auth** | Firebase Authentication |
| **AI — LLM** | OpenAI (GPT-4.1), Anthropic (Claude 3.5 Sonnet), Google (Gemini 2.5 Flash), Ollama (lokal) |
| **AI — STT** | Deepgram (Nova-3), OpenAI (gpt-4o-mini-transcribe), Whisper (lokal), Gemini Live |
| **Verschlüsselung** | AES-256-GCM + OS Keychain (keytar) |
| **Build** | esbuild (Renderer), Electron Builder (Packaging) |
| **Hosting** | Firebase Hosting (Web), Auto-Update (Desktop) |

---

## Electron Desktop App

### Main Process

**Entry Point:** `src/index.js`

- Initialisiert die Electron-App und Fensterverwaltung
- Registriert IPC-Handler über Bridge-Module
- Verwaltet Firebase Auth und App-Lifecycle
- Steuert Auto-Updates via electron-updater

**Preload Script:** `src/preload.js`
- Exponiert sichere APIs an den Renderer via Context Bridge
- Plattformerkennung, Event-Listener

**Build:** `build.js`
- ESBuild-Konfiguration für Renderer-Bundles
- Output: `public/build/header.js` und `public/build/content.js`

### Feature-Architektur

Jedes Feature folgt dem **Service + Repository Pattern**:

```
Feature/
├── featureService.js        # Business-Logik
└── repositories/
    ├── index.js             # Adapter (routet zu SQLite oder Firebase)
    ├── sqlite.repository.js # Lokale Implementierung
    └── firebase.repository.js # Cloud Implementierung
```

#### Ask (LLM Q&A)
- Streaming-LLM-Antworten
- Screenshot-Erfassung (macOS nativ + Electron Fallback)
- Bildverarbeitung mit sharp
- Session-Persistenz

#### Listen (Audio-Transkription)
- Koordiniert STT- und Summary-Services
- Session-Lifecycle: initialize → transcribe → summarize
- Keep-Alive-Mechanismus für Sessions >25 Minuten
- Session-Pooling (max. 3 gleichzeitige Sessions)

#### Summary (Meeting-Zusammenfassungen)
- Generiert Zusammenfassungen aus Transkripten
- Extrahiert Action Items und Bullet Points
- Speichert in Firestore Sub-Collections

### AI Provider System

**Factory:** `src/features/common/ai/factory.js`

| Provider | LLM-Modelle | STT-Modelle |
|----------|-------------|-------------|
| OpenAI | gpt-4.1 | gpt-4o-mini-transcribe |
| OpenAI (Glass) | gpt-4.1-glass | gpt-4o-mini-transcribe-glass |
| Anthropic | claude-3-5-sonnet | — |
| Gemini | gemini-2.5-flash | gemini-live-2.5-flash |
| Deepgram | — | nova-3 |
| Ollama (lokal) | dynamisch | — |
| Whisper (lokal) | — | tiny / base / small / medium |

**Factory-Methoden:**
- `createLLM(provider, opts)` — Synchrone LLM-Instanz
- `createStreamingLLM(provider, opts)` — Streaming-Antworten
- `createSTT(provider, opts)` — Speech-to-Text-Instanz

### Datenbank (SQLite)

**Client:** `src/features/common/services/sqliteClient.js`

**Pfad:**
- macOS: `~/Library/Application Support/Glass/pickleglass.db`
- Windows: `%APPDATA%\Glass\pickleglass.db`

**Schema (9 Tabellen):**

| Tabelle | Zweck | Schlüsselfelder |
|---------|-------|-----------------|
| `users` | Benutzerprofile | uid (PK), display_name, email, has_migrated_to_firebase |
| `sessions` | Sitzungen | id (PK), uid, title, session_type (ask/listen), sync_state |
| `transcripts` | STT-Ausgabe | id (PK), session_id, text, speaker, lang, sync_state |
| `ai_messages` | LLM-Antworten | id (PK), session_id, role, content, tokens, model, sync_state |
| `summaries` | Zusammenfassungen | session_id (PK), text, tldr, bullet_json, action_json |
| `prompt_presets` | Gespeicherte Prompts | id (PK), uid, title, prompt, is_default |
| `provider_settings` | API-Key-Speicher | provider (PK), api_key (verschlüsselt), selected_llm_model |
| `ollama_models` | Lokale LLM-Modelle | name (PK), size, installed, installing |
| `whisper_models` | Lokale STT-Modelle | id (PK), name, size, installed, installing |

**Features:**
- WAL (Write-Ahead Logging) für bessere Concurrency
- Schema-Synchronisierung beim Start
- Automatische Migration alter Strukturen
- Bereinigung verwaister Sessions

### Encryption

**Service:** `src/features/common/services/encryptionService.js`

- **Algorithmus:** AES-256-GCM
- **Key-Management:** keytar (OS Keychain), Fallback auf In-Memory-Key
- **Format:** Base64(IV + AuthTag + CipherText)
- **Verschlüsselte Felder:** Prompt-Titel, Session-Titel, Transkript-Text, AI-Nachrichten, Zusammenfassungen

### Lokale AI Services

#### Ollama (`ollamaService.js`)
- Basis-URL: `http://localhost:11434`
- Auto-Install, Model-Download, Warmup-Mechanismus, Checkpoint-System

#### Whisper (`whisperService.js`)
- Modelle: tiny (39MB), base (74MB), small (244MB), medium (769MB)
- Session-Pooling (max. 3 gleichzeitig), Datei-Download mit Checksummen

---

## Next.js Web Dashboard

**Verzeichnis:** `pickleglass_web/`

### Routing & Seiten

| Route | Beschreibung |
|-------|-------------|
| `/` | Redirect → `/personalize` |
| `/login` | Google Sign-In & lokaler Modus |
| `/personalize` | Prompt-Preset-Editor |
| `/activity` | Session-Liste |
| `/activity/details?sessionId=X` | Session-Details (Transkripte, Zusammenfassungen, Q&A) |
| `/settings` | Profil-Einstellungen |
| `/settings/privacy` | Daten & Datenschutz |
| `/settings/billing` | Billing & API-Key-Verwaltung |
| `/help` | Hilfeseite |
| `/download` | Download-Seite |

### Komponenten

```
RootLayout (layout.tsx)
└── ClientLayout
    ├── Sidebar (kollabierbar, 220px ↔ 64px)
    │   ├── Navigation (Search, Activity, Personalize, Settings)
    │   ├── Settings-Submenu (Profile, Privacy, Billing)
    │   └── User-Profil & Links (Discord, Downloads)
    ├── Main Content Area → Seiteninhalt
    └── SearchPopup (Cmd/Ctrl+K)
```

### State Management

- **Kein externes State-Management** — React Hooks (useState, useEffect, useCallback, useMemo)
- **Auth-State:** Firebase `onAuthStateChanged` via `useAuth()` Hook
- **User-Info:** localStorage unter `pickleglass_user`
- **Modus:** Local (default_user) vs. Firebase (Cloud-Sync)

### API-Kommunikation

- Runtime-URL aus `/runtime-config.json`, Fallback: `http://localhost:9001`
- Headers mit `X-User-ID`
- Endpunkte: `/api/conversations`, `/api/user/profile`, `/api/presets`, `/api/user/api-key-status`

---

## Firebase Backend

### Cloud Functions

**Datei:** `functions/index.js` — **Runtime:** Node.js 20, **Region:** us-west1

**Einzige Funktion: `pickleGlassAuthCallback`** (HTTP POST)
1. Empfängt Firebase ID Token vom Electron-Client
2. Validiert Token via Firebase Admin SDK
3. Gibt Custom Token + User-Metadaten zurück (uid, email, name, picture)

### Firestore-Struktur

```
users/{uid}
  └── displayName, email, createdAt

sessions/{sessionId}
  ├── uid, members, title, session_type, started_at, ended_at
  ├── transcripts/{transcriptId}    # Sub-Collection
  ├── ai_messages/{messageId}       # Sub-Collection
  └── summary/data                  # Einzeldokument

prompt_presets/{presetId}
  └── uid, title, prompt, is_default, created_at
```

### Authentication Flow

```
1. User klickt "Sign In"
      ↓
2. Browser öffnet Web-Login-Seite
      ↓
3. Web App tauscht Credentials gegen Firebase ID Token
      ↓
4. ID Token → Cloud Function `pickleGlassAuthCallback`
      ↓
5. Function validiert Token → gibt Custom Token zurück
      ↓
6. Custom Token für Firestore-Zugriff in Electron App
```

---

## Daten-Synchronisation

**Adapter Pattern:** Jedes Repository routet basierend auf Auth-Status:

```
Nicht eingeloggt  →  SQLite (lokal)
Eingeloggt        →  SQLite + Firebase (Sync)
```

**Sync-Strategie:**
- `sync_state` Feld: `clean` | `dirty` | `syncing`
- Lazy Migration: Daten werden bei Login zu Firebase synchronisiert
- Batch-Operationen mit 500-Op-Limit (Firestore-Quota)

**Migration Service** (`migrationService.js`):
- 2-Phasen-Migration: Parent-Docs zuerst, dann Sub-Collections
- Verschlüsselt Felder vor Firestore-Push
- Markiert User als `has_migrated_to_firebase`

---

## Sicherheit

| Bereich | Maßnahme |
|---------|----------|
| **API Keys** | AES-256-GCM verschlüsselt in SQLite |
| **Encryption Keys** | OS Keychain via keytar |
| **User-Daten** | Client-seitige Verschlüsselung vor Firestore-Write |
| **Auth Tokens** | Firebase Custom Tokens (kurzlebig, signiert) |
| **SQL Injection** | Parameterisierte Queries durchgehend |
| **IPC** | Context Bridge mit eingeschränkter API-Oberfläche |

---

## Build & Deployment

| Ziel | Tooling | Output |
|------|---------|--------|
| **Desktop (macOS)** | Electron Builder | DMG-Installer |
| **Desktop (Windows)** | Electron Builder | EXE/NSIS-Installer |
| **Desktop (Linux)** | Electron Builder | Snap/AppImage |
| **Web Dashboard** | Next.js Static Export | Firebase Hosting |
| **Cloud Functions** | Firebase CLI | `firebase deploy --only functions` |

**Code Signing:** macOS Notarization via `notarize.js`, Entitlements in `entitlements.plist`

---

## Scripts

```bash
# Setup
npm run setup              # Alle Dependencies installieren

# Entwicklung
npm start                  # Dev-Server mit Hot Reload
npm run watch:renderer     # Renderer Watch-Mode
firebase emulators:start   # Lokale Firebase-Emulation

# Build
npm run build              # Production Build (alle Plattformen)
npm run build:web          # Nur Next.js
npm run build:renderer     # Nur Electron UI

# Deployment
firebase deploy --only functions   # Cloud Functions
firebase deploy --only hosting     # Web Dashboard
```

---

## Standard-Prompt-Presets

Die App kommt mit 5 vorinstallierten Templates:

| Preset | Anwendungsfall |
|--------|---------------|
| **School** | Akademisches Tutoring |
| **Meetings** | Action Items extrahieren |
| **Sales** | Einwandbehandlung |
| **Recruiting** | Kandidatenbewertung |
| **Customer Support** | Troubleshooting |

---

## Firebase-Funktionalität (entfernt — Referenz für Reimplementierung)

> **Status:** Firebase wurde entfernt, um das Projekt unabhängig von Pickle's Infrastruktur betreiben zu können. Dieser Abschnitt dokumentiert die vollständige Funktionalität für eine spätere Reimplementierung mit eigenem Firebase-Projekt oder Supabase.

### Überblick

Firebase erfüllte vier Funktionen:
1. **Authentication** — Google Sign-In, Token-Austausch
2. **Firestore** — Cloud-Datenbank für Geräte-übergreifenden Sync
3. **Cloud Functions** — Auth-Callback-Handler
4. **Hosting** — Web Dashboard Deployment

**Kernprinzip:** Offline-First. SQLite ist immer primär. Firebase war optional und wurde nur bei Login aktiviert. Es gab **keine Echtzeit-Synchronisation** — ein Adapter-Pattern schaltete zwischen SQLite und Firestore um.

### Authentication Flow

```
1. User klickt "Login" in Electron App
2. Browser öffnet → /login?mode=electron
3. Google OAuth via Firebase Auth im Browser
4. Browser erhält Firebase ID Token
5. Redirect zu pickleglass://auth-success?token={idToken}
6. Electron empfängt Deep Link
7. POST an Cloud Function: pickleGlassAuthCallback
   - Payload: { token: idToken }
   - Validiert Token via admin.auth().verifyIdToken()
   - Erstellt Custom Token: admin.auth().createCustomToken(uid)
   - Response: { success, user: { uid, email, name, picture }, customToken }
8. Electron: signInWithCustomToken(auth, customToken)
9. onAuthStateChanged listener feuert → User ist eingeloggt
```

**Post-Login Aktionen:**
- `userRepository.findOrCreate(firebaseUser)` — User in DB anlegen/aktualisieren
- `encryptionService.initializeKey(user.uid)` — Verschlüsselungskey laden
- `migrationService.checkAndRunMigration(user)` — Einmalige SQLite→Firestore Migration
- `sessionRepository.endAllActiveSessions()` — Zombie-Sessions beenden

**User-State:**
```javascript
// Eingeloggt
{ uid: user.uid, email: user.email, displayName: user.displayName, mode: 'firebase', isLoggedIn: true }

// Ausgeloggt
{ uid: 'default_user', email: 'contact@pickle.com', displayName: 'Default User', mode: 'local', isLoggedIn: false }
```

**Logout:** `signOut(auth)` → Encryption Key löschen → Adapter schaltet auf SQLite → `default_user`

### Firestore Datenmodell

#### Collections & Felder

**users/{uid}**
| Feld | Typ | Verschlüsselt | Beschreibung |
|------|-----|---------------|-------------|
| uid | string | nein | Firebase UID (PK) |
| display_name | string | nein | Anzeigename |
| email | string | nein | E-Mail |
| email_verified | boolean | nein | Optional |
| auto_update_enabled | boolean | nein | Auto-Update Setting |
| created_at | Timestamp | — | Erstellungszeitpunkt |
| updated_at | Timestamp | — | Letzte Änderung |

**sessions/{sessionId}**
| Feld | Typ | Verschlüsselt | Beschreibung |
|------|-----|---------------|-------------|
| uid | string | nein | Besitzer |
| members | array\<string\> | nein | UIDs (für zukünftiges Sharing, default: [uid]) |
| title | string | **ja** | Session-Titel |
| session_type | string | nein | 'ask' \| 'listen' |
| started_at | Timestamp | — | Startzeit |
| ended_at | Timestamp\|null | — | Endzeit (null = aktiv) |
| updated_at | Timestamp | — | Letzte Änderung |
| created_at | Timestamp | — | Erstellungszeitpunkt |

**sessions/{sessionId}/transcripts/{transcriptId}**
| Feld | Typ | Verschlüsselt | Beschreibung |
|------|-----|---------------|-------------|
| uid | string | nein | Sprecher/Autor |
| session_id | string | nein | Zugehörige Session |
| text | string | **ja** | Transkript-Text |
| speaker | string\|null | nein | 'me', 'other', oder Name |
| lang | string | nein | Sprache (z.B. 'en', 'ko') |
| start_at | Timestamp | — | Beginn des Segments |
| end_at | Timestamp | — | Ende des Segments |
| created_at | Timestamp | — | Erstellungszeitpunkt |

**sessions/{sessionId}/ai_messages/{messageId}**
| Feld | Typ | Verschlüsselt | Beschreibung |
|------|-----|---------------|-------------|
| uid | string | nein | Autor |
| session_id | string | nein | Zugehörige Session |
| role | string | nein | 'user' \| 'assistant' |
| content | string | **ja** | Nachrichteninhalt |
| tokens | number | nein | Token-Anzahl (optional) |
| model | string | nein | Modellname (optional) |
| sent_at | Timestamp | — | Sendezeitpunkt |
| created_at | Timestamp | — | Erstellungszeitpunkt |

**sessions/{sessionId}/summary/data** (feste Document-ID: `data`)
| Feld | Typ | Verschlüsselt | Beschreibung |
|------|-----|---------------|-------------|
| uid | string | nein | Autor |
| session_id | string | nein | Zugehörige Session |
| text | string | **ja** | Volltext-Zusammenfassung |
| tldr | string | **ja** | Kurzzusammenfassung |
| bullet_json | string | **ja** | JSON-Array mit Bullet Points |
| action_json | string | **ja** | JSON-Array mit Action Items |
| model | string | nein | Verwendetes Modell |
| tokens_used | number | nein | Verbrauchte Tokens (optional) |
| generated_at | Timestamp | — | Generierungszeitpunkt |
| updated_at | Timestamp | — | Letzte Änderung |

**prompt_presets/{presetId}**
| Feld | Typ | Verschlüsselt | Beschreibung |
|------|-----|---------------|-------------|
| uid | string | nein | Besitzer |
| title | string | **ja** | Preset-Titel |
| prompt | string | **ja** | Prompt-Text |
| is_default | number | nein | 0 \| 1 |
| created_at | Timestamp | — | Erstellungszeitpunkt |
| updated_at | Timestamp | — | Letzte Änderung |

**defaults/v1/prompt_presets/{presetId}** (System-Presets, nicht verschlüsselt, read-only)
| Feld | Typ | Beschreibung |
|------|-----|-------------|
| title | string | Preset-Titel |
| prompt | string | Prompt-Text |
| is_default | number | Immer 1 |
| created_at | Timestamp | Erstellungszeitpunkt |

### Verschlüsselung (Client-seitig)

- **Algorithmus:** AES-256-GCM
- **Format:** `Base64(IV [16 Bytes] + AuthTag [16 Bytes] + CipherText)`
- **Key-Management:** OS Keychain via `keytar` (Service: `com.pickle.glass`, Account: `userId`), Fallback: In-Memory-Key
- **Graceful Degradation:** Entschlüsselung gibt bei Fehler den Originaltext zurück, unterstützt gemischte verschlüsselte/unverschlüsselte Daten

**Verschlüsselte Felder pro Collection:**
- sessions: `title`
- transcripts: `text`
- ai_messages: `content`
- summaries: `tldr`, `text`, `bullet_json`, `action_json`
- prompt_presets: `title`, `prompt`

### Firestore Converter Pattern

```javascript
createEncryptedConverter(fieldsToEncrypt = [])
// toFirestore(appObject): Verschlüsselt angegebene Felder, fügt updated_at hinzu
// fromFirestore(snapshot): Entschlüsselt Felder, konvertiert Timestamps → Unix Seconds
```

**Timestamp-Konvertierung:** Firestore `Timestamp.seconds` → Unix Seconds (App-weit). Bei Migration: `Timestamp.fromMillis(seconds * 1000)`.

### Repository Adapter Pattern

Jedes Feature hat drei Dateien:

```
repositories/
├── index.js                  # Adapter — prüft authService.getCurrentUser().isLoggedIn
├── sqlite.repository.js      # Lokale Implementierung
└── firebase.repository.js    # Cloud Implementierung
```

**Routing-Logik:**
```javascript
// Vereinfacht
function getBaseRepository() {
    return authService.getCurrentUser().isLoggedIn ? firebaseRepository : sqliteRepository;
}
```

### Repository-Methoden (Interface für Reimplementierung)

**User Repository:**
```javascript
findOrCreate(user: { uid, email, displayName, photoURL }) → Promise<UserData>
getById(uid: string) → Promise<UserData | null>
update({ uid, displayName }) → Promise<{ changes: number }>
deleteById(uid: string) → Promise<{ success: true }>  // Kaskadiert: User + Sessions + Presets + Sub-Collections
```

**Session Repository:**
```javascript
create(uid: string, type?: 'ask' | 'listen') → Promise<string>  // returns sessionId
getById(id: string) → Promise<SessionData | null>
getAllByUserId(uid: string) → Promise<SessionData[]>  // Query: members array-contains uid, orderBy started_at desc
getOrCreateActive(uid: string, requestedType?: string) → Promise<string>
updateTitle(id: string, title: string) → Promise<{ changes: 1 }>
updateType(id: string, type: string) → Promise<{ changes: 1 }>
touch(id: string) → Promise<void>  // Setzt updated_at
end(id: string) → Promise<{ changes: 1 }>  // Setzt ended_at
deleteWithRelatedData(id: string) → Promise<{ success: true }>  // Kaskadiert: Session + 3 Sub-Collections
endAllActiveSessions(uid: string) → Promise<{ changes: number }>  // Alle offenen Sessions beenden
```

**Transcript Repository (STT):**
```javascript
addTranscript({ uid, sessionId, speaker, text }) → Promise<{ id: string }>
getAllTranscriptsBySessionId(sessionId: string) → Promise<TranscriptData[]>  // orderBy start_at asc
```

**AI Message Repository (Ask):**
```javascript
addAiMessage({ uid, sessionId, role, content, model }) → Promise<{ id: string }>
getAllAiMessagesBySessionId(sessionId: string) → Promise<AiMessageData[]>  // orderBy sent_at asc
```

**Summary Repository:**
```javascript
saveSummary({ uid, sessionId, tldr, text, bullet_json, action_json, model }) → Promise<{ changes: 1 }>  // Upsert auf feste Doc-ID 'data'
getSummaryBySessionId(sessionId: string) → Promise<SummaryData | null>
```

**Preset Repository:**
```javascript
getPresets(uid: string) → Promise<PresetData[]>  // Defaults + User-Presets, sortiert
getPresetTemplates() → Promise<PresetData[]>  // Nur System-Defaults
create({ uid, title, prompt }) → Promise<string>
update(id: string, { title, prompt }, uid: string) → Promise<void>
delete(id: string, uid: string) → Promise<void>
getAutoUpdate(uid: string) → Promise<boolean>
setAutoUpdate(uid: string, isEnabled: boolean) → Promise<void>
```

### Migration Service (SQLite → Firestore)

**Trigger:** Einmalig beim ersten Login, wenn `has_migrated_to_firebase === false`.

**Phase 1 — Parent-Dokumente (Batch, max 500 Ops):**
- Alle `prompt_presets`: Verschlüsselt `title` + `prompt`, konvertiert Timestamps
- Alle `sessions`: Verschlüsselt `title`, setzt `members: [uid]`, konvertiert Timestamps

**Phase 2 — Sub-Collections (pro Session):**
- `transcripts`: Verschlüsselt `text`, fügt `lang: 'en'` hinzu
- `ai_messages`: Verschlüsselt `content`
- `summary`: Verschlüsselt `tldr`, `text`, `bullet_json`, `action_json`, feste Doc-ID `data`

**Phase 3 — Abschluss:**
- Setzt `has_migrated_to_firebase = true` in SQLite

### Web Dashboard API (Express Backend)

Das Web Dashboard kommuniziert über einen eingebetteten Express-Server mit dem Electron Main Process via IPC.

**Middleware:** `X-User-ID` Header → `req.uid`

**Endpunkte:**

| Route | Method | Beschreibung |
|-------|--------|-------------|
| `/api/user/profile` | GET | Benutzerprofil laden |
| `/api/user/profile` | PUT | Anzeigename ändern |
| `/api/user/find-or-create` | POST | User anlegen/synchronisieren |
| `/api/user/api-key` | POST | API-Key speichern |
| `/api/user/api-key-status` | GET | API-Key Validität prüfen |
| `/api/user/profile` | DELETE | Account + alle Daten löschen |
| `/api/user/batch` | GET | Profil + Presets + Sessions gebündelt |
| `/api/conversations` | GET | Alle Sessions auflisten |
| `/api/conversations` | POST | Neue Session erstellen |
| `/api/conversations/:id` | GET | Session + Transcripts + Messages + Summary |
| `/api/conversations/:id` | DELETE | Session mit allen Daten löschen |
| `/api/presets` | GET/POST | Presets lesen/erstellen |
| `/api/presets/:id` | PUT/DELETE | Preset ändern/löschen |

### Hinweis: Pfad-Diskrepanz

Die Electron-App und das Web Dashboard verwenden **unterschiedliche Firestore-Pfade**:

- **Electron (Backend):** Top-Level Collections — `/sessions/{id}`, Filter über `uid`-Feld
- **Web Dashboard (TypeScript):** Verschachtelt — `/users/{uid}/sessions/{id}`

Bei einer Reimplementierung muss diese Diskrepanz aufgelöst werden.

### Betroffene Dateien (entfernt)

```
src/features/common/services/firebaseClient.js      # Firebase Init + Firestore-Instanz
src/features/common/services/authService.js          # Auth-State + User-Management
src/features/common/services/migrationService.js     # SQLite → Firestore Migration
src/features/common/repositories/firestoreConverter.js  # Verschlüsselungs-Wrapper
src/features/*/repositories/firebase.repository.js   # Alle Firebase-Repository-Implementierungen
src/features/*/repositories/index.js                 # Adapter (vereinfacht auf SQLite-only)
functions/index.js                                   # Cloud Function
pickleglass_web/utils/firebase.ts                    # Web Dashboard Firebase Config
pickleglass_web/utils/firestore.ts                   # Web Dashboard Firestore Services
```

---

*Generiert am 2026-03-24 — basierend auf dem aktuellen Stand der Codebase.*
