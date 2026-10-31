# Making a Jyson extension

An extension adds things Jyson can do: tools the AI can call, phrases that work without the AI, settings, and
reactions to what happens on the PC. Anyone can make one. This page is the whole contract (extension API 2,
Jyson 2.4.0 and newer).

> **Community extensions are the author's responsibility.** Jyson checks every community extension before it is
> listed, but its author is responsible for what it does and for keeping it safe. Users see this before they
> install, see exactly what the extension asks for, and can report it from Settings. Jyson can withdraw any
> extension for everyone.

## 1. Try it on your PC

1. Copy [`extension-template/`](extension-template) to a folder of your own.
2. In Jyson: **Settings → Integrations → Make your own extensions → Developer mode**, then **Load from folder...**
   and pick that folder. Restart Jyson.
3. Ask Jyson something that should use your tool, or say one of your phrases.

Developer-mode extensions run in their own process, exactly like a listed community extension.

## 2. `main.py`

```python
API_VERSION = 2

PERMISSIONS = {
    "hosts": ["api.example.com"],     # internet hosts it may reach (HTTPS only); [] = none
    "local_network": False,           # programs on this PC (e.g. OBS on localhost)
    "oauth": [],                      # Jyson sign-ins it may use: "spotify", "google", "microsoft", "twitch"
    "speak": True,                    # say things / show messages on the island
}

TOOLS = [                             # what the AI may call (OpenAI function format)
    {"type": "function", "function": {
        "name": "weather_now", "description": "Current weather for a city.",
        "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]}}},
]

COMMANDS = [                          # whole phrases, regular expressions; named groups become arguments
    {"say": [r"weather in (?P<city>.+)"], "tool": "weather_now"},
]

SETTINGS_SCHEMA = [                   # the Configure form in Settings
    {"key": "units", "label": "Units", "type": "choice", "options": ["metric", "imperial"], "default": "metric"},
    {"key": "api_key", "label": "API key", "type": "secret"},
]

def register(api):
    """Called once at start. Return {tool name: function(**arguments) -> str}."""
    global API
    API = api
    return {"weather_now": weather_now}

def weather_now(city):
    reply = API.http("GET", "https://api.example.com/weather", params={"q": city},
                     headers={"Authorization": "Bearer " + (API.get_secret("api_key") or "")})
    if reply["status"] != 200:
        return "ERROR: the weather service didn't answer."
    return f"{city}: {reply['json']['summary']}"

# Optional:
def start(api): ...                   # after loading (background work: keep it light)
def stop(api): ...                    # Jyson is closing
def on_event(api, name, data): ...    # "jyson_started", "jyson_closing", "game_started", "game_ended", "track_changed"
def test_connection(api): return "OK" # the "Test connection" button
def health(api): return "OK"
```

Setting types: `text`, `secret` (stored encrypted, never shown again), `switch`, `choice` (`options`),
`sign_in` (`provider`: one of your `PERMISSIONS["oauth"]`), `button` (`tool`: runs that tool when clicked).

## 3. The `api` object

| Method | What it does |
|---|---|
| `api.http(method, url, headers=None, params=None, json_body=None, data=None, timeout=15)` | One request through Jyson: HTTPS only, only your `hosts` (this PC only with `local_network`), refused in Local-only mode. Returns `{"status", "headers", "text", "json"}`. |
| `api.get_setting(key, default)` / `api.set_setting(key, value)` | Your own settings (text, numbers, on/off). |
| `api.get_secret(name)` / `api.set_secret(name, value)` | Your own encrypted secrets. Removed when the extension is removed. |
| `api.oauth_token(provider)` / `api.oauth_client_id(provider)` | A fresh token of the user's Jyson sign-in (only providers in your `oauth`). |
| `api.say(text)` / `api.notify(text)` | Speak, or show a message. Needs `"speak": True`. |
| `api.log(text)` | A line in Jyson's error log (no secrets, please). |
| `api.local_only()` | True while the user has Local-only mode on. |
| `api.jyson_version()` | The running Jyson version. |

**Between versions:** within API 2, methods are only ever added - never removed or changed - so an extension
keeps working on newer Jyson. Check `api.jyson_version()` before using a newer method. A future API 3 would be
a new `API_VERSION`: an older Jyson refuses such an extension with "update Jyson" instead of half-loading it,
and the list's `min_jyson_version` keeps it from being offered there at all.

Nothing else of Jyson is reachable: an extension can't read chats, memory, keys or other extensions' settings
through the API.

## 4. Rules for listed extensions

- Pure Python (standard library only; Jyson can't install packages). Everything in one folder, `main.py` at the top.
- All internet access through `api.http`. Raw sockets only to this PC, and only with `local_network`.
- No starting programs, no reading or writing files outside your folder, no keyboard or clipboard capture, no
  code built at runtime (`eval`, `exec`, downloading code).
- Ask only for the permissions you use; describe in plain words what each tool does.
- Every action that changes something outside Jyson goes through a tool, so the user is asked first.
- No ads, tracking or data collection the user didn't ask for.

## 5. Getting it listed

1. Check it: `python tools/pack_extension.py check <folder>` (in the Jyson desktop source) lists the lines a
   reviewer will read.
2. Send it to Jyson (jysenai.support@gmail.com): the folder, a description, your name as it should appear, a
   link where people can reach you, and what each permission is for.
3. We review the code. If it's accepted we package it reproducibly, pin its exact SHA-256, add it to
   `extensions_manifest.json` with `"publisher": "community"` and your name as `author`, and sign the list.
   Updates go through the same review.
4. Users see it in **Settings → Integrations → Extensions** with "Community extension by <you> - not made by
   Jyson", what it asks for, and our note. It runs in its own process.

## 6. Safety, reports and withdrawal

- **Report:** every extension in Settings has a **Report** button (a pre-filled email to us). Reports are read and
  answered.
- **Withdrawal:** the signed list has a `revoked` section. A withdrawn extension stops loading on every PC at the
  next start and can't be installed again. The list's `sequence` number only grows, so an older list can't bring
  it back.
- **Honest limit:** an extension's process runs as the Windows user, like any program they install. The review,
  the exact pinning, the separate process, the visible permissions, reports and withdrawal are what keep users
  safe - so an extension that tries to get around them is withdrawn.
