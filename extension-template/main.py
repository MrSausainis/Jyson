"""A Jyson extension to start from (EXTENSIONS.md). Rename the folder, then change everything below."""
API_VERSION = 2

PERMISSIONS = {
    "hosts": [],               # e.g. ["api.example.com"]
    "local_network": False,
    "oauth": [],
    "speak": True,
}

SETTINGS_SCHEMA = [
    {"key": "greeting", "label": "Greeting", "type": "text", "default": "Hello"},
]

TOOLS = [
    {"type": "function", "function": {
        "name": "template_greet",
        "description": "Greet someone by name (an example tool from the extension template).",
        "parameters": {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]}}},
]

COMMANDS = [
    {"say": [r"greet (?P<name>.+)"], "tool": "template_greet"},
]

api = None


def register(jyson_api):
    global api
    api = jyson_api
    return {"template_greet": template_greet}


def template_greet(name):
    return f"{api.get_setting('greeting', 'Hello')}, {name}!"


def test_connection(jyson_api):
    return f"The template extension is running in Jyson {jyson_api.jyson_version()}."
