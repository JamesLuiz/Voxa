import logging
from livekit.agents import function_tool, RunContext
import requests

logger = logging.getLogger(__name__)

@function_tool()
async def get_weather(
    context: RunContext,  # type: ignore
    city: str,
) -> str:
    """
    Get the current weather for a given city.
    """
    try:
        response = requests.get(f"https://wttr.in/{city}?format=3")
        if response.status_code == 200:
            logger.debug(f"Weather for {city}: {response.text.strip()}")
            return response.text.strip()
        else:
            logger.warning(f"Failed to get weather for {city}: {response.status_code}")
            return f"Could not retrieve weather for {city}."
    except Exception as e:
        logger.warning(f"Error retrieving weather for {city}: {e}")
        return f"An error occurred while retrieving weather for {city}."


