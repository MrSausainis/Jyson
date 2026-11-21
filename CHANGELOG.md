# Changelog

All notable changes to Jyson AI. Downloads are on the
[releases page](https://github.com/MrSausainis/Jyson/releases).

## 1.0.0 - first public version

Jyson 1.0 is the first version for everyone. Versions 2.1 to 2.4 were private tests with a few people; they are
retired, and anyone still on one installs 1.0 by hand once (it cannot update itself to a lower version number).

### What's in it

#### Jyson Bar (JB) - a new taskbar
- **Your apps, the clock and your music in one bar** on every monitor, with window previews, pinned apps and the
  tray - at the bottom, or at the top in two parts with Mochi between them. It hides by itself if Windows' taskbar
  does, and never comes up over a full-screen game.
- **Make it yours:** looks (Neon, Frosted, Liquid glass, Deep glass, Clear, Midnight, White and more), nine accent
  colours, sizes, opacity down to fully see-through, and an editor where you drag widgets onto the bar.
- **Widgets:** weather, calendar (iCal), CPU, GPU (NVIDIA), RAM, AI requests today, screen time, timer, Pomodoro,
  stopwatch, world clocks, currency, day line, uptime and more, grouped in the editor.
- **Quick settings** from the Wi-Fi / volume button: Wi-Fi, Bluetooth, Airplane mode, microphone, night light with
  a strength slider, audio output, volume, the brightness of every screen (laptop screens too) and Windows
  settings pages.
- **Windows Tweaks** (Settings > Taskbar, each one off or on): the wheel over the bar turns the volume,
  middle-click closes an app, Win + D only on the monitor you are on.

#### Jyson Mochi (the Dynamic Island)
- **A compact island at the top** for listening, timers, music and what Jyson is doing; long titles run round in a
  loop instead of stretching it.
- **Layers:** rest on it for a music player (cover, progress, previous / play / next), scroll for a small menu.
- A saved clip is confirmed with a card showing its first frame. Optional soft interface sounds.

#### Desktop widgets
- A big clock with the weekday in thin capitals, today's plan, and a calendar with your own photo. Drag them anywhere.

#### Clips
- **F8 saves the last seconds of your screen and PC sound** (15-120 s), recorded in memory with your NVIDIA GPU
  when there is one; nothing is written until you save.
- **A clip editor with a timeline:** pictures of the clip along a strip, handles for the part to keep, play,
  rename, and a copy small enough for Discord.
- Choose the length, frame rate, quality and the monitor to record.

#### Files
- Photos, videos and clips Jyson got or made, in one place, with pictures, search, rename and Show in folder.

#### AI, voice and memory
- **Voice, push to talk and hotkeys.** Say "Jyson", or hold a key and talk. Commands survive typos and mixed
  English and Lithuanian.
- **Cloud or local AI.** Seven cloud providers with your own key (stored with Windows encryption), or an optional
  local model.
- **Memory you can talk to:** Settings > Memory > Ask or change - ask what Jyson remembers, change or forget it in
  plain words.
- **PC control** with an exact one-time approval for anything that closes apps or changes files.

#### Account and plans
- **Free, or a free 14-day trial** of every feature, started from your account page when you want (once every
  60 days). Paid plans open later.
- Gift and discount codes in Settings > Account > Have a code?

#### Help when something goes wrong
- **Copy diagnostics** (Settings > System) puts a short report on the clipboard - versions, which parts work, recent
  problems - with keys, emails and personal paths removed.
- **Guardian** restarts Jyson after an unexpected failure.

### Installing
Download `Jyson-AI-Setup.exe` from the [releases page](https://github.com/MrSausainis/Jyson/releases) and run it.
Updates install from inside Jyson and keep your settings, keys, memory, chats and models.

### Known limitations
- The installer is not code-signed yet, so Microsoft SmartScreen may warn the first time. Updates are checked
  against Jyson's release signature before they install.
- Tested on Windows 11; Windows 10 has not been tested.
- Phone link (Jyson Mobile for Android) is coming later; it is not part of 1.0.
- Listening for "Jyson" on your PC understands English.
- The GPU widget needs an NVIDIA card.
