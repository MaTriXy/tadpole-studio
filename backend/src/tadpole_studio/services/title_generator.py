"""
LLM-powered title generation for songs and DJ conversations.

Uses the configured DJ LLM provider for short, creative titles.
Fallback chain: configured provider -> built-in (MLX) -> Ollama -> random title list.
"""

import random
import re

from loguru import logger

from tadpole_studio.db.connection import get_db
from tadpole_studio.services.llm_provider import get_provider

_RANDOM_TITLE_EXAMPLES = [
    "Your Mama Likes Bananas",
    "Duckling Yellow",
    "Nightshift Boulevard",
    "MFW I Am at the Mall Picking Up Soap",
    "Cardboard Astronaut",
    "Three Cats on a Tuesday",
    "Velvet Parking Lot",
    "My Dentist Has a Pony",
    "Fog Machine Romance",
    "Leftover Spaghetti Dreams",
    "The Accountant's Mixtape",
    "Cactus in a Tuxedo",
    "Pigeons Know Something",
    "Lost My Keys in the Ocean",
    "Grandma's Turbo Engine",
    "Elevator to Nowhere",
    "Lukewarm Coffee Club",
    "Suspicious Mangoes",
    "Midnight at the Laundromat",
    "Flamingo on Line 4",
    "Raccoon Diplomacy",
    "Sunburn in December",
    "The Toaster Knows",
    "Parking Ticket Serenade",
    "Jellyfish Commute",
    "Blanket Fort Manifesto",
    "Haunted Vending Machine",
    "Squirrel with a Briefcase",
    "Neon Lullaby",
    "Tuesday Smells Like Rain",
    "Goldfish Philosophy",
    "Shoelace Conspiracy",
    "Disco in the Basement",
    "Paper Airplane Dynasty",
    "The Moth Convention",
    "Sidewalk Astronomy",
    "Penguin on Parole",
    "Bubblewrap Symphony",
    "Llama at the Checkout",
    "Postcard from Saturn",
    "Invisible Bicycle",
    "Marmalade Emergency",
    "Twelve Spoons and a Hat",
    "Warehouse Daydream",
    "Borrowed Thunder",
    "Sloth in First Class",
    "Tambourine Verdict",
    "Half a Sunset",
    "Corduroy Moonlight",
    "Fortune Cookie Rebellion",
    "Umbrella for a Goldfish",
    "Static on Channel 9",
    "Origami Getaway Car",
    "Pockets Full of Fog",
    "Turnip Serenade",
]


async def _get_configured_llm() -> tuple:
    """Read the configured DJ provider/model from settings and return (provider, model_name).

    Falls back to the built-in provider if the configured one is unavailable.
    """
    provider_name = "built-in"
    model_name = ""

    try:
        db = await get_db()
        cursor = await db.execute(
            "SELECT key, value FROM settings WHERE key IN ('dj_provider', 'dj_model')"
        )
        rows = await cursor.fetchall()
        for row in rows:
            if row["key"] == "dj_provider":
                provider_name = row["value"]
            elif row["key"] == "dj_model":
                model_name = row["value"]
    except Exception as e:
        logger.debug(f"Failed to read DJ settings, using built-in: {e}")

    provider = get_provider(provider_name)
    if provider is not None and await provider.is_available():
        return (provider, model_name)

    # Fallback to built-in
    if provider_name != "built-in":
        logger.debug(f"Provider '{provider_name}' unavailable for title gen, falling back to built-in")
        builtin = get_provider("built-in")
        if builtin is not None and await builtin.is_available():
            return (builtin, "")

    # Fallback to Ollama (e.g., on Windows where built-in MLX is unavailable)
    if provider_name != "ollama":
        logger.debug("Trying Ollama as fallback for LLM")
        ollama = get_provider("ollama")
        if ollama is not None and await ollama.is_available():
            ollama_models = await ollama.list_models_async()
            if ollama_models:
                return (ollama, ollama_models[0])

    return (None, "")


def _clean_title(raw: str) -> str:
    """Strip thinking tags, quotes, and multi-line noise from LLM output."""
    # Remove <think>...</think> blocks
    cleaned = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
    # Take only the first non-empty line
    for line in cleaned.splitlines():
        line = line.strip()
        if line:
            cleaned = line
            break
    # Strip surrounding quotes
    if len(cleaned) >= 2 and cleaned[0] in ('"', "'", "\u201c") and cleaned[-1] in ('"', "'", "\u201d"):
        cleaned = cleaned[1:-1].strip()
    # Remove trailing period
    cleaned = cleaned.rstrip(".")
    # Cap length
    if len(cleaned) > 80:
        cleaned = cleaned[:77] + "..."
    return cleaned


async def generate_song_title(
    caption: str,
    genre: str,
    mood: str,
    fallback: str,
) -> str:
    """Generate a creative song title from a caption using the built-in chat LLM.

    Falls back to caption truncation if the LLM is unavailable.
    """
    provider, model_name = await _get_configured_llm()
    if provider is None:
        logger.info("Auto-title: no LLM provider available, using random title")
        return await generate_random_title()

    logger.info(f"Auto-title: generating song title via {provider.name}/{model_name or 'default'}")

    messages = [
        {
            "role": "system",
            "content": (
                "Generate a single short, evocative song title (1-8 words). "
                "Output ONLY the title, nothing else."
            ),
        },
        {
            "role": "user",
            "content": f"Caption: {caption}\nGenre: {genre}\nMood: {mood}",
        },
    ]

    try:
        raw = await provider.chat(messages, model=model_name, max_tokens=50)
        title = _clean_title(raw)
        if title:
            logger.info(f"Auto-title: \"{title}\"")
            return title
    except Exception as e:
        logger.debug(f"LLM title generation failed, using fallback: {e}")

    return await generate_random_title()


async def generate_random_title(
    avoid_titles: list[str] | None = None,
) -> str:
    """Generate a random, creative song title unrelated to any caption.

    Used by radio to produce unique, quirky titles every time.
    Falls back to a random pick from built-in examples.
    """
    # Pick a few random examples to show the LLM the vibe
    examples = random.sample(_RANDOM_TITLE_EXAMPLES, min(5, len(_RANDOM_TITLE_EXAMPLES)))
    examples_str = ", ".join(f'"{e}"' for e in examples)

    avoid_str = ""
    if avoid_titles:
        avoid_str = (
            "\nDo NOT reuse any of these recent titles: "
            + ", ".join(f'"{t}"' for t in avoid_titles[:10])
        )

    provider, model_name = await _get_configured_llm()
    if provider is None:
        logger.info("Random title: no LLM provider available, picking from examples")
        # Fallback: pick a random example that isn't in avoid list
        pool = [t for t in _RANDOM_TITLE_EXAMPLES if t not in (avoid_titles or [])]
        return random.choice(pool) if pool else random.choice(_RANDOM_TITLE_EXAMPLES)

    logger.info(f"Random title: generating via {provider.name}/{model_name or 'default'}")

    messages = [
        {
            "role": "system",
            "content": (
                "Invent a single quirky, fun, unexpected song title (1-8 words). "
                "It should be creative and random — NOT describe the music. "
                "Think absurd, funny, poetic, or surreal. "
                f"Examples of the vibe: {examples_str}. "
                "Do NOT copy those examples. Make up something completely new."
                f"{avoid_str}\n"
                "Output ONLY the title, nothing else."
            ),
        },
        {
            "role": "user",
            "content": "Give me a random song title.",
        },
    ]

    try:
        raw = await provider.chat(messages, model=model_name, max_tokens=50, temperature=1.0)
        title = _clean_title(raw)
        if title and title not in (avoid_titles or []) and title not in _RANDOM_TITLE_EXAMPLES:
            logger.info(f"Random title: \"{title}\"")
            return title
    except Exception as e:
        logger.debug(f"LLM random title generation failed, using fallback: {e}")

    # Fallback
    pool = [t for t in _RANDOM_TITLE_EXAMPLES if t not in (avoid_titles or [])]
    return random.choice(pool) if pool else random.choice(_RANDOM_TITLE_EXAMPLES)


async def generate_conversation_title(user_message: str) -> str:
    """Generate a concise conversation title from the first user message.

    Falls back to message truncation if the LLM is unavailable.
    """
    stripped = user_message.strip()
    fallback_title = stripped[:50]
    if len(stripped) > 50:
        fallback_title += "..."

    provider, model_name = await _get_configured_llm()
    if provider is None:
        logger.info("Conversation title: no LLM provider available, using truncation")
        return fallback_title

    logger.info(f"Conversation title: generating via {provider.name}/{model_name or 'default'}")

    messages = [
        {
            "role": "system",
            "content": (
                "Generate a concise conversation title (2-6 words). "
                "Output ONLY the title, nothing else."
            ),
        },
        {
            "role": "user",
            "content": user_message,
        },
    ]

    try:
        raw = await provider.chat(messages, model=model_name, max_tokens=30)
        title = _clean_title(raw)
        if title:
            logger.info(f"Conversation title: \"{title}\"")
            return title
    except Exception as e:
        logger.debug(f"LLM conversation title generation failed, using fallback: {e}")

    return fallback_title
