<div align="center">

# Jyson AI

**A new taskbar, a Dynamic Island and an AI assistant for Windows 11.**

[Website](https://get-jyson.netlify.app) · [Download](https://github.com/MrSausainis/Jyson/releases/latest) · [Changelog](CHANGELOG.md)

</div>

---

## About

Jyson rebuilds the parts of Windows you look at all day. The **Jyson Bar (JB)** replaces the taskbar with your apps,
music and widgets; the **Dynamic Island** at the top shows what is happening; **F8** saves the last seconds of your
screen as a clip; and an assistant you can talk to controls the PC. It stays light while idle and never gets in the
way of a game.

## Highlights

- **Jyson Bar.** Apps, window previews, the clock and your music on every monitor. Themes, accent colours, sizes, a
  layout editor and widgets: weather, calendar, CPU, GPU, RAM, timers, world clocks and more.
- **Quick settings.** Wi-Fi, Bluetooth, Airplane mode, microphone, night light, audio output, volume and the
  brightness of every screen, one click from the bar.
- **Dynamic Island.** Listening, timers, music and Jyson's actions in a compact island; rest on it for a music
  player, scroll for a menu.
- **Clips.** F8 keeps the last 15-120 seconds of your screen and sound; trim it on a timeline, rename it, or make a
  copy small enough for Discord.
- **Files.** Photos, videos and clips in one place with pictures and search.
- **Voice and hotkeys.** Say "Jyson" or hold a key and talk; commands survive typos and mixed English and
  Lithuanian. Global hotkeys work while a game is in front.
- **Cloud or local AI.** Use a cloud provider with your own key, or an optional local model.
- **Memory you can talk to.** Ask what Jyson remembers, and change or forget it in plain words.
- **Windows Tweaks.** Volume on the bar's wheel, middle-click to close, Win + D on one monitor - each one optional.
- **Guardian.** A separate watchdog restarts Jyson after an unexpected failure, and respects Quit and Restart.

## Plans

Jyson works on **Free**. Every account can take a **free 14-day trial** of every feature from its account page,
with no card. Paid plans open later; see the [website](https://get-jyson.netlify.app).

## AI and privacy

Cloud AI uses your own provider key, stored with Windows encryption, never in a plain-text file. Local AI is
optional and downloaded separately; every model file is checked with SHA-256.

Settings, memory, conversations and clips are stored apart from the app itself, so updates never replace them.
Diagnostic reports remove keys, emails, IP addresses and personal paths before anything is copied.

## Requirements

- Windows 11 (Windows 10 has not been tested yet)
- Clips record with an NVIDIA GPU when there is one, and with the CPU otherwise
- Cloud AI needs a supported provider API key
- Local AI is optional and works best with a GPU that has enough VRAM; model files are not in the installer

## Install

Download **`Jyson-AI-Setup.exe`** from the [latest release](https://github.com/MrSausainis/Jyson/releases/latest) and
run it. Updating keeps all your settings and data.

The installer is not code-signed yet, so Microsoft SmartScreen may show a warning the first time you install or run
it. Updates are signed: Jyson installs an update only if it carries the release signature.

## Project status

Jyson 1.0 is the first public version and is under active development. See the [changelog](CHANGELOG.md) for what
changed. Support, your account and the plans are on the [website](https://get-jyson.netlify.app).

## License

Jyson AI is proprietary software: **all rights reserved**. You may download it from the official releases and use
it, but not copy, redistribute, modify or reuse its code, website or designs. See [LICENSE](LICENSE).
Open-source components inside the app keep their own licences (listed in `THIRD_PARTY_NOTICES.md` next to the app).
