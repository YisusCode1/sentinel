import hashlib
import hmac
import secrets


API_KEY_PREFIX = "sntl_live_"


def generate_api_key() -> str:
    """Genera una API key criptográficamente segura."""
    return API_KEY_PREFIX + secrets.token_urlsafe(32)


def hash_api_key(api_key: str) -> str:
    """Almacena únicamente el SHA-256 de la clave."""
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def get_key_prefix(api_key: str) -> str:
    """Obtiene el prefijo público para localizar la clave."""
    return api_key[:20]


def verify_api_key(api_key: str, stored_hash: str) -> bool:
    """Compara hashes en tiempo constante."""
    calculated_hash = hash_api_key(api_key)

    return hmac.compare_digest(
        calculated_hash,
        stored_hash,
    )
