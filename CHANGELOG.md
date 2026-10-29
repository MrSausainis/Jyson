# Changelog

All notable changes to Jyson AI. Downloads are on the
[releases page](https://github.com/MrSausainis/Jyson/releases).

Versions before 2.3.0 are no longer listed. Jyson moved to a new update system with signed updates, and those
older versions can't receive updates or support any more. If you still run one, install the latest version from the
[releases page](https://github.com/MrSausainis/Jyson/releases).

## 2.3.0 - 2026-10-17

Jyson meets your phone: calls and messages show up on the Dynamic Island, and the phone can control the PC. Jyson now hears its name on your PC, so it stops going deaf in long gaming sessions. Answers appear as they are written, the natural voice is new, Settings is rebuilt, and updates are now signed.

### ✨ New

#### Phone link (preview)
- **Pair your Android phone** in Settings → Phone link. Jyson works on the same Wi-Fi and over the internet. The connection is end-to-end encrypted, and the PC never opens a port: it always dials out to the phone.
- **Calls and messages on the Dynamic Island.** When someone calls or writes, the island shows who it is, so you don't miss it while you play. Choose what shows (calls, messages, other apps, the message text) and from whom (everyone, or only the people and apps you pick).
- **Many messages from one person** become one notice with a count, instead of a stream.
- **Missed calls when you're back.** If you were away from the PC, Jyson tells you about the calls you missed as soon as you use it again.
- The island stays solid (not see-through) while a call or message is shown.
- **Control the PC from the phone:** see its status, control music, and open or close apps. Each of these can be switched off in Settings → Phone link. A phone can never answer Jyson's own confirmations for you.
- **Confirm it's me.** The phone asks for your fingerprint or PIN once after each unlock before it controls the PC, so a lost phone can't.
- The Jyson Mobile Android app is in testing and will be on the website soon.

#### Jyson hears its name on your PC
- **A small model on your PC listens for "Jyson"**, so only what you say to Jyson goes to the cloud. Game voice chat and videos stay on your PC.
- This fixes **Jyson going deaf during long gaming sessions.** Always-on listening sent so much audio to the cloud speech service that its daily limit ran out.
- About 100 MB of memory and a sliver of one CPU core, no GPU: fine in games. It ships with the installer and sets itself up a few seconds after the first start. No download.
- It also gives **Local-only mode** a voice (English).
- If the cloud speech limit is reached anyway, Jyson switches to another speech model, and the island tells you instead of silently ignoring you.

#### Answers as they are written
- **Typed questions get their answer word by word**, as the AI writes it, instead of all at once at the end.
- **Formatting in the chat:** answers to typed questions show headings, lists, **bold** and code.
- **Pictures in research answers.** A web search answer can show a picture from the search, in the chat and on the island card. Switch it off in Settings → Dynamic Island → Pictures in research answers.

#### A new natural voice
- **Kokoro** replaces Pocket TTS as the natural local voice: clearer, and its first words start sooner. Get it in Settings → Voice & Audio. The old voice keeps working until you switch, and "Remove the old voice (Pocket TTS)" frees about 1.1 GB.
- **Cloud voice in games** (off by default). A game pauses the natural voice to keep the game smooth. Switch this on and a cloud voice speaks then instead of the Windows voice. It uses nothing on your PC.

#### AI
- **A new main cloud model**, GPT-OSS-120B, with the previous one as a fallback.
- **Gemma 4 as a local model.** Choose E2B, E4B or 12B in Settings → AI → Local AI model, to match your PC.
- **Games, apps and products it doesn't know** are looked up instead of guessed.
- **"Can you see my screen?"** now makes Jyson look at your screen.
- **Short media replies.** "Paused", "Next song", not a full sentence.

#### Apps
- **Jyson knows how popular apps really open and close.** Steam shuts down properly. Tray apps like Discord or FACEIT are fully closed, not just hidden. FACEIT AC is started before FACEIT, and never closed in the middle of a CS2 match.
- **Spotify questions:** "what's next?", "where is this playing from?" and "add … to the queue".
- **Undo a deleted chat** for 10 seconds.
- **An icon in the notification area** (by the clock): click it to open Jyson, right-click for Settings, the microphone and Quit. To keep Jyson running when you close the window, turn on Settings → General → Keep running when the window is closed.

#### Settings
- **Rebuilt.** A compact list of pages on the left with icons, your account at the top, Updates at the bottom, and Jyson's chat blurred behind.
- **Two columns** on wide windows, balanced so there are no empty gaps.
- **Account** is the first page, **Updates** the last. The old Advanced page is gone: its settings moved to AI, Voice & Audio and System.
- **Clearer rows.** Each setting has a bold name, a short grey explanation and a line between rows.

### 🐛 Bug fixes
- **Jyson woke up on its own from TikTok or game audio.** The speech service sometimes wrote "Jyson" by itself. A wake is now checked a second time before Jyson listens.
- **A stretched "Jyson"** is now heard as the name.
- **An app Jyson had started could block the next update.** It loaded files from Jyson's own folder, so the installer couldn't replace them. Apps started by Jyson no longer do this.
- **The CS2 bomb timer** was a few seconds off. CS2 reports a plant late. The timer now measures CS2's delay from real explosions.
- **The answer card on the island** now opens on hover during a game too.

### 🔒 Security
- **Signed updates.** From this version on, Jyson installs an update only if it carries Jyson's own signature, on top of GitHub's checksum. An installer uploaded with a stolen GitHub login can't install itself.
- **Phone text is cleaned** before the island shows it, so a message can't hide or reverse what the island says.
- **Pairing limits per device.** Another device on the Wi-Fi can't use up the pairing attempts while you pair your phone.

### ⬆️ Updating from 2.2.0
**Check for updates** in Jyson finds this update. Your settings, keys, memory, chats and downloaded models carry over.

### ⚠️ Known limitations
- Phone link needs the Jyson Mobile Android app, which is not public yet.
- On Xiaomi/HyperOS phones, Autostart must be allowed for Jyson Mobile, or calls and messages don't reach the PC.
- Local listening understands English.
