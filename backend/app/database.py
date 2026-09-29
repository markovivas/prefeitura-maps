import os
from contextlib import contextmanager
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://prefeitura:prefeitura_secret@indoor_db:5432/prefeitura_indoor",
)


def get_connection():
    """Retorna uma nova conexão com o PostgreSQL/PostGIS."""
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


@contextmanager
def get_db_cursor(commit: bool = False):
    """Gerenciador de contexto para executar queries SQL no PostGIS."""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            yield cursor
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
