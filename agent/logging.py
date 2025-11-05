import logging
import sys

def setup_logging() -> None:
    """Setup logging configuration based on execution mode."""
    is_console_mode = any(arg in sys.argv for arg in ['console', 'dev', '--dev', '--console'])
    if is_console_mode:
        logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    else:
        logging.basicConfig(level=logging.WARNING, format='%(asctime)s - %(levelname)s - %(message)s')
        for logger_name in [
            'livekit', 'livekit.agents', 'mistralai', 'httpx', 'httpcore',
            'urllib3', 'google', 'openai', 'langchain'
        ]:
            logging.getLogger(logger_name).setLevel(logging.ERROR)
            logging.getLogger(logger_name).propagate = False

def get_logger(name: str) -> logging.Logger:
    """Return a module logger configured per setup_logging."""
    if 'start' in sys.argv or 'prod' in sys.argv:
        logging.getLogger().setLevel(logging.ERROR)
        lg = logging.getLogger(name)
        lg.setLevel(logging.WARNING)
        return lg
    return logging.getLogger(name)


