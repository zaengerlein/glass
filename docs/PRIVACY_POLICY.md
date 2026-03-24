# Privacy Policy — Glass

**Last updated:** 2026-03-24

## Overview

Glass is an open-source desktop application that runs locally on your computer. This privacy policy explains how Glass handles your data.

## Data Collection

**Glass does not collect, transmit, or store any personal data on external servers.** All data is stored locally on your device in a SQLite database.

### Data stored locally

- **Session data:** Transcripts, AI messages, and summaries from your Ask and Listen sessions
- **User preferences:** Display name, prompt presets, and application settings
- **API keys:** Your AI provider API keys, encrypted with AES-256-GCM and stored in your operating system's keychain

### Data sent to third parties

When you use AI features, Glass sends data to the AI provider you have configured:

| Provider | Data sent | Purpose |
|----------|-----------|---------|
| OpenAI | Audio data, text prompts, screenshots | Speech-to-text, LLM responses |
| Anthropic | Text prompts, screenshots | LLM responses |
| Google Gemini | Audio data, text prompts | Speech-to-text, LLM responses |
| Deepgram | Audio data | Speech-to-text |
| Ollama (local) | Text prompts | LLM responses (stays on your machine) |
| Whisper (local) | Audio data | Speech-to-text (stays on your machine) |

These transmissions happen directly between your device and the provider's API. Glass does not route data through any intermediary servers. The provider's own privacy policy governs how they handle your data.

## Data Storage & Security

- All data is stored in `~/Library/Application Support/Glass/pickleglass.db` (macOS) or `%APPDATA%\Glass\pickleglass.db` (Windows)
- Sensitive fields (session titles, transcripts, AI messages, summaries, prompt presets) are encrypted with AES-256-GCM
- Encryption keys are stored in your operating system's keychain (macOS Keychain / Windows Credential Manager)
- No data is sent to any server unless you explicitly use a cloud AI provider

## Data Deletion

You can delete all your data at any time by:
- Using the "Delete Account" option in Settings
- Deleting the application data directory
- Uninstalling the application

## Analytics & Tracking

Glass does not include any analytics, telemetry, or tracking software.

## Changes to This Policy

Changes to this privacy policy will be documented in the project's Git history. The "Last updated" date at the top indicates the most recent revision.

## Contact

For questions about this privacy policy, please open an issue at [github.com/zaengerlein/glass](https://github.com/zaengerlein/glass).
