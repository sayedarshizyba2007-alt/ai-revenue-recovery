import uuid
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from backend.database import db


def create_audit_entry(
    event_type: str,
    actor: str,
    details: Dict[str, Any],
    recovery_case_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Creates an immutable audit log entry for system transparency.
    Event Types: DETECTION, DIAGNOSIS, RECOMMENDATION, APPROVAL, EXECUTION, RECOVERY, STOP
    """
    log_id = f"audit_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)

    details_str = json.dumps(details) if isinstance(details, dict) else str(details)

    row = {
        "id": log_id,
        "recovery_case_id": recovery_case_id,
        "event_type": event_type,
        "actor": actor,
        "details": details_str,
        "created_at": now.isoformat()
    }

    db.insert("audit_logs", row)
    return row


def fetch_audit_logs(limit: int = 100) -> list:
    """Fetch audit logs ordered by creation timestamp."""
    logs = db.fetch_all("audit_logs", limit=limit)
    # Sort descending by created_at
    logs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return logs
