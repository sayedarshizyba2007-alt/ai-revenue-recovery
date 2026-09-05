import os
import sqlite3
import json
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime
from config import settings
from supabase import create_client, Client

BASE_DIR = Path(__file__).resolve().parent.parent
SQLITE_DB_PATH = BASE_DIR / "data" / "revenue_recovery_demo.db"


class DatabaseService:
    """
    Unified Database abstraction supporting:
    1. Primary: Supabase PostgreSQL (when credentials exist in .env)
    2. Fallback: Local SQLite DEMO MODE (when Supabase credentials are unconfigured)
    
    If Supabase credentials ARE configured but fail to connect, this service raises 
    an explicit exception rather than hiding the error by silently switching to SQLite.
    """

    def __init__(self):
        self._supabase_client: Optional[Client] = None
        self._mode: str = settings.db_mode
        self._init_db()

    @property
    def mode(self) -> str:
        if settings.is_supabase_configured:
            if not self._supabase_client:
                self._init_db()
            return "SUPABASE"
        return "LOCAL_DEMO_MODE"

    def _init_db(self):
        if settings.is_supabase_configured:
            try:
                self._supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
                self._mode = "SUPABASE"
            except Exception as e:
                raise RuntimeError(
                    f"Supabase credentials configured, but failed to initialize client: {str(e)}. "
                    "Per safety rules, system will not silently fallback to SQLite when Supabase is configured."
                )
        else:
            self._mode = "LOCAL_DEMO_MODE"
            SQLITE_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
            self._init_sqlite_schema()

    def _get_sqlite_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(SQLITE_DB_PATH))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_sqlite_schema(self):
        schema_file = BASE_DIR / "backend" / "schema.sql"
        if not schema_file.exists():
            return
        with open(schema_file, "r", encoding="utf-8") as f:
            sql_script = f.read()

        with self._get_sqlite_conn() as conn:
            conn.executescript(sql_script)
            conn.commit()

    def reset_all_tables(self):
        """Idempotently clear all synthetic tables for clean re-seeding."""
        tables = [
            "audit_logs",
            "recovery_attempts",
            "recovery_cases",
            "transactions",
            "checkout_sessions",
            "customers",
            "merchants"
        ]

        if self._mode == "SUPABASE_POSTGRES" and self._supabase_client:
            for table in tables:
                try:
                    self._supabase_client.table(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
                except Exception as e:
                    # Alternative RPC or individual deletes
                    pass
        else:
            with self._get_sqlite_conn() as conn:
                for table in tables:
                    conn.execute(f"DELETE FROM {table};")
                conn.commit()

    def insert_batch(self, table: str, rows: List[Dict[str, Any]]):
        """Insert multiple records into a table safely."""
        if not rows:
            return

        if self._mode == "SUPABASE_POSTGRES" and self._supabase_client:
            # Batch insert in chunks of 500
            chunk_size = 500
            for i in range(0, len(rows), chunk_size):
                chunk = rows[i:i + chunk_size]
                res = self._supabase_client.table(table).insert(chunk).execute()
        else:
            with self._get_sqlite_conn() as conn:
                first_row = rows[0]
                keys = list(first_row.keys())
                columns_str = ", ".join(keys)
                placeholders = ", ".join(["?"] * len(keys))
                sql = f"INSERT OR REPLACE INTO {table} ({columns_str}) VALUES ({placeholders})"

                param_tuples = [tuple(r[k] for k in keys) for r in rows]
                conn.executemany(sql, param_tuples)
                conn.commit()

    def insert(self, table: str, row: Dict[str, Any]) -> Dict[str, Any]:
        """Insert a single row."""
        self.insert_batch(table, [row])
        return row

    def fetch_all(self, table: str, filters: Optional[Dict[str, Any]] = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Fetch records from a table with optional exact-match filters and limit."""
        if self._mode == "SUPABASE_POSTGRES" and self._supabase_client:
            query = self._supabase_client.table(table).select("*")
            if filters:
                for k, v in filters.items():
                    query = query.eq(k, v)
            if limit:
                query = query.limit(limit)
            res = query.execute()
            return res.data or []
        else:
            with self._get_sqlite_conn() as conn:
                sql = f"SELECT * FROM {table}"
                params = []
                if filters:
                    where_clauses = [f"{k} = ?" for k in filters.keys()]
                    sql += " WHERE " + " AND ".join(where_clauses)
                    params = list(filters.values())
                if limit:
                    sql += f" LIMIT {limit}"

                cursor = conn.cursor()
                cursor.execute(sql, params)
                rows = cursor.fetchall()
                return [dict(r) for r in rows]

    def query_raw(self, sql_query: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
        """Run raw SQL query (for SQLite local engine analysis)."""
        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(sql_query, params or ())
            rows = cursor.fetchall()
            return [dict(r) for r in rows]

    def update(self, table: str, row_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update a row by ID."""
        if self._mode == "SUPABASE_POSTGRES" and self._supabase_client:
            res = self._supabase_client.table(table).update(updates).eq("id", row_id).execute()
            return res.data[0] if res.data else None
        else:
            with self._get_sqlite_conn() as conn:
                keys = list(updates.keys())
                set_clause = ", ".join([f"{k} = ?" for k in keys])
                sql = f"UPDATE {table} SET {set_clause} WHERE id = ?"
                values = [updates[k] for k in keys] + [row_id]
                conn.execute(sql, values)
                conn.commit()

            fetched = self.fetch_all(table, filters={"id": row_id}, limit=1)
            return fetched[0] if fetched else None


db = DatabaseService()
