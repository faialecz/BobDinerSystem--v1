from __future__ import annotations

import time
import psycopg2
import psycopg2.pool
from dotenv import load_dotenv
import os

load_dotenv()

_pool: psycopg2.pool.ThreadedConnectionPool | None = None


def _get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _pool
    if _pool is None or _pool.closed:
        _pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=10,  # raised from 5; stays under Supabase free-tier limit (15 direct)
            user=os.getenv("PGUSER"),
            password=os.getenv("PGPASSWORD"),
            host=os.getenv("PGHOST"),
            port=os.getenv("PGPORT"),
            dbname=os.getenv("PGDATABASE"),
            sslmode="require",
        )
    return _pool


class _PooledConnection:
    """
    Thin wrapper so existing routes can call conn.close() and the underlying
    connection is returned to the pool rather than destroyed.
    """

    def __init__(self, conn, pool: psycopg2.pool.ThreadedConnectionPool):
        self._conn = conn
        self._pool = pool

    def cursor(self, *args, **kwargs):
        return self._conn.cursor(*args, **kwargs)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        # Return to pool instead of closing — no other file needs to change
        if self._conn is not None:
            self._pool.putconn(self._conn)
            self._conn = None

    def __del__(self):
        # Safety net: return connection if caller forgot to call close()
        if getattr(self, "_conn", None) is not None:
            try:
                self._pool.putconn(self._conn)
                self._conn = None
            except Exception:
                pass


def get_connection() -> _PooledConnection:
    pool = _get_pool()
    # Retry up to 3 times with a short backoff before giving up.
    # Handles brief bursts where all connections are momentarily checked out.
    last_err: Exception | None = None
    for attempt in range(3):
        try:
            conn = pool.getconn()
            return _PooledConnection(conn, pool)
        except psycopg2.pool.PoolError as e:
            last_err = e
            time.sleep(0.1 * (attempt + 1))  # 100ms, 200ms, 300ms
    raise last_err  # type: ignore[misc]
