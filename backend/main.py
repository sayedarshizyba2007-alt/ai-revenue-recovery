import sys
from pathlib import Path

# Ensure backend directory is in sys.path for direct imports (Vercel & local compatibility)
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from config import settings
from database import db
from seed import seed_synthetic_data
from detection.engine import run_detection_engine
from ai.gemini_service import diagnose_revenue_risk
from recovery.executor import execute_recovery_step, get_recovery_metrics
from audit.logger import create_audit_entry, fetch_audit_logs
from intervention.engine import INTERVENTION_POLICIES

app = FastAPI(
    title="Razorpay AI Revenue Recovery Backend",
    description="Production-grade AI Revenue Recovery system backend for Razorpay Buildathon Track 03",
    version="1.0.0"
)

# Enable CORS for local React frontend (Vite default port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter()


@api_router.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "revenue-recovery-backend",
        "db_mode": db.mode,
        "gemini_configured": settings.is_gemini_configured,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@api_router.get("/db/health")
def db_health_check():
    return {
        "status": "ok",
        "db_mode": db.mode,
        "supabase_configured": settings.is_supabase_configured
    }


@api_router.post("/seed")
def seed_data(reset: bool = Query(False, description="Whether to reset and re-seed clean 90-day dataset")):
    """Idempotently seed 90-day synthetic dataset with payment degradation and checkout abandonment."""
    try:
        res = seed_synthetic_data(reset=reset)
        # Automatically run initial risk detection after seeding
        run_detection_engine()
        create_audit_entry(
            event_type="DETECTION",
            actor="SystemSeeder",
            details={"action": "synthetic_dataset_seeded", "reset": reset}
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to seed data: {str(e)}")


@api_router.get("/dashboard/summary")
def get_dashboard_summary():
    """Returns high-level summary KPIs and metrics for executive dashboard."""
    metrics = get_recovery_metrics()
    detection_res = run_detection_engine()
    risks = detection_res.get("risks", [])

    return {
        "metrics": metrics,
        "active_risks": risks,
        "db_mode": db.mode,
        "ai_status": "GEMINI_LIVE" if settings.is_gemini_configured else "DEMO_FALLBACK",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@api_router.get("/risks")
def get_all_risks():
    """Returns all detected revenue at risk cases with calculated evidence."""
    detection_res = run_detection_engine()
    return detection_res


@api_router.get("/risks/{risk_id}")
def get_risk_detail(risk_id: str):
    """Returns specific risk details including live calculated evidence, breakdown metrics, case status, and audit trail."""
    detection_res = run_detection_engine()
    risk_info = next((r for r in detection_res.get("risks", []) if r["id"] == risk_id), None)

    cases = db.fetch_all("recovery_cases", filters={"id": risk_id})
    if not cases and not risk_info:
        raise HTTPException(status_code=404, detail=f"Risk case '{risk_id}' not found.")

    case = cases[0] if cases else None
    attempts = db.fetch_all("recovery_attempts", filters={"recovery_case_id": risk_id})
    audit = [a for a in fetch_audit_logs(limit=200) if a.get("recovery_case_id") == risk_id]

    breakdown_analytics = {}
    if risk_info:
        if risk_info.get("risk_type") == "payment_degradation":
            breakdown_analytics = get_payment_degradation_analytics()
        elif risk_info.get("risk_type") == "checkout_abandonment":
            breakdown_analytics = get_checkout_abandonment_analytics()

    return {
        "risk_info": risk_info,
        "case": case,
        "attempts": attempts,
        "audit_trail": audit,
        "breakdown": breakdown_analytics
    }


@api_router.post("/risks/{risk_id}/diagnose")
def diagnose_risk(risk_id: str):
    """Triggers AI diagnosis for a detected revenue risk using Gemini (or fallback)."""
    cases = db.fetch_all("recovery_cases", filters={"id": risk_id})
    if not cases:
        # Run detection to populate cases if needed
        run_detection_engine()
        cases = db.fetch_all("recovery_cases", filters={"id": risk_id})

    if not cases:
        raise HTTPException(status_code=404, detail=f"Risk case '{risk_id}' not found.")

    case = cases[0]

    # Gather risk context for AI reasoning
    detection_res = run_detection_engine()
    risk_data = next((r for r in detection_res.get("risks", []) if r["id"] == risk_id), {
        "risk_type": case["source_type"],
        "title": f"Risk Case {risk_id}",
        "risk_score": case["risk_score"],
        "amount_at_risk": case["amount_at_risk"],
        "evidence": [case.get("diagnosis", "At risk revenue detected")]
    })

    diagnosis_res = diagnose_revenue_risk(risk_data)

    # Save diagnosis result
    import json
    diag_json = json.dumps(diagnosis_res)
    db.update("recovery_cases", risk_id, {
        "diagnosis": diag_json,
        "recommended_action": diagnosis_res.get("recommended_action", "payment_retry"),
        "status": "diagnosed",
        "updated_at": datetime.now(timezone.utc).isoformat()
    })

    create_audit_entry(
        event_type="DIAGNOSIS",
        actor="GeminiAIEngine",
        details={
            "ai_provider": diagnosis_res.get("ai_provider", "Gemini"),
            "model_used": diagnosis_res.get("model_used", "gemini-2.5-flash"),
            "ai_status": diagnosis_res.get("ai_status", "GEMINI_LIVE"),
            "confidence": diagnosis_res.get("confidence"),
            "recommended_action": diagnosis_res.get("recommended_action"),
            "risk_id": risk_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        },
        recovery_case_id=risk_id
    )

    return diagnosis_res


@api_router.post("/risks/{risk_id}/approve")
def approve_risk_recovery(risk_id: str):
    """Approves recovery intervention for a diagnosed case."""
    cases = db.fetch_all("recovery_cases", filters={"id": risk_id})
    if not cases:
        raise HTTPException(status_code=404, detail=f"Risk case '{risk_id}' not found.")

    case = cases[0]
    updated = db.update("recovery_cases", risk_id, {
        "status": "approved",
        "updated_at": datetime.now(timezone.utc).isoformat()
    })

    create_audit_entry(
        event_type="APPROVAL",
        actor="OperationsLead",
        details={
            "action": "approved_for_recovery",
            "recommended_action": case.get("recommended_action", "payment_retry"),
            "amount_at_risk": case.get("amount_at_risk")
        },
        recovery_case_id=risk_id
    )

    return {"status": "approved", "case": updated}


@api_router.post("/risks/{risk_id}/execute")
def execute_risk_recovery(risk_id: str, action: Optional[str] = Query(None)):
    """Executes a bounded recovery attempt for an approved risk case."""
    try:
        res = execute_recovery_step(risk_id, force_action=action)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/recovery/metrics")
def recovery_metrics_endpoint():
    """Returns proven money recovered metrics."""
    return get_recovery_metrics()


@api_router.get("/recovery/cases")
def list_recovery_cases():
    """Lists all recovery cases and execution history."""
    cases = db.fetch_all("recovery_cases")
    attempts = db.fetch_all("recovery_attempts")

    cases.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return {"cases": cases, "total_attempts": len(attempts)}


@api_router.get("/audit")
def list_audit_trail(limit: int = 100):
    """Returns complete auditable event log."""
    logs = fetch_audit_logs(limit=limit)
    return {"logs": logs, "total_logs": len(logs)}


@api_router.get("/checkout/abandonment")
def get_checkout_abandonment_analytics():
    """Returns detailed checkout session abandonment analytics."""
    checkouts = db.fetch_all("checkout_sessions")
    abandoned = [c for c in checkouts if c.get("status") == "abandoned"]

    # Stage breakdown
    by_stage: Dict[str, int] = {}
    by_stage_val: Dict[str, float] = {}
    for c in abandoned:
        st = c.get("stage", "unknown")
        val = float(c.get("cart_amount", 0))
        by_stage[st] = by_stage.get(st, 0) + 1
        by_stage_val[st] = round(by_stage_val.get(st, 0.0) + val, 2)

    total_cart_at_risk = round(sum(float(c.get("cart_amount", 0)) for c in abandoned), 2)
    recoverable_carts = [c for c in abandoned if c.get("recovery_eligible")]

    return {
        "total_checkout_sessions": len(checkouts),
        "total_abandoned_sessions": len(abandoned),
        "abandonment_rate": round((len(abandoned) / len(checkouts) * 100), 2) if checkouts else 0.0,
        "total_abandoned_cart_value": total_cart_at_risk,
        "abandonment_by_stage": by_stage,
        "abandoned_value_by_stage": by_stage_val,
        "recoverable_carts_count": len(recoverable_carts),
        "recoverable_carts": recoverable_carts[:50]  # Top 50 sample
    }


@api_router.get("/payments/degradation")
def get_payment_degradation_analytics():
    """Returns detailed payment failure rate analytics."""
    txns = db.fetch_all("transactions")
    failed = [t for t in txns if t.get("status") == "failed"]

    by_method: Dict[str, Dict[str, Any]] = {}
    for t in txns:
        pm = t.get("payment_method", "unknown")
        if pm not in by_method:
            by_method[pm] = {"total": 0, "failed": 0, "failed_amount": 0.0}
        by_method[pm]["total"] += 1
        if t.get("status") == "failed":
            by_method[pm]["failed"] += 1
            by_method[pm]["failed_amount"] += float(t.get("amount", 0))

    for pm, d in by_method.items():
        d["failure_rate"] = round((d["failed"] / d["total"] * 100), 2) if d["total"] > 0 else 0.0
        d["failed_amount"] = round(d["failed_amount"], 2)

    by_reason: Dict[str, int] = {}
    for t in failed:
        r = t.get("failure_reason") or "unknown"
        by_reason[r] = by_reason.get(r, 0) + 1

    return {
        "total_transactions": len(txns),
        "failed_transactions": len(failed),
        "overall_failure_rate": round((len(failed) / len(txns) * 100), 2) if txns else 0.0,
        "total_failed_amount": round(sum(float(t.get("amount", 0)) for t in failed), 2),
        "by_payment_method": by_method,
        "by_failure_reason": by_reason
    }


# Mount API router under both /api (for Vercel deployment) and root / (for local dev)
app.include_router(api_router, prefix="/api")
app.include_router(api_router)
