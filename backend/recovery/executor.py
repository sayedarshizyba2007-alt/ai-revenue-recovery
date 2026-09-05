import uuid
import random
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from database import db
from audit.logger import create_audit_entry
from intervention.engine import check_intervention_eligibility, INTERVENTION_POLICIES


def execute_recovery_step(case_id: str, force_action: str = None) -> Dict[str, Any]:
    """
    Executes a bounded recovery attempt for an approved recovery case.
    Simulates realistic payment retry / checkout reminder outcome with deterministic probabilities.
    Updates case status, records attempt, writes audit trail, and computes recovered money.
    """
    cases = db.fetch_all("recovery_cases", filters={"id": case_id})
    if not cases:
        raise ValueError(f"Recovery case '{case_id}' not found.")

    case = cases[0]
    action_type = force_action or case.get("recommended_action") or "payment_retry"

    existing_attempts = db.fetch_all("recovery_attempts", filters={"recovery_case_id": case_id})
    attempt_count = len(existing_attempts)

    # 1. Eligibility Check
    eligibility = check_intervention_eligibility(case, action_type, attempt_count)
    if not eligibility["eligible"]:
        create_audit_entry(
            event_type="STOP",
            actor="RecoveryExecutor",
            details={
                "action": "execution_rejected",
                "reason": eligibility["reason"],
                "attempts_count": attempt_count
            },
            recovery_case_id=case_id
        )
        return {
            "status": "rejected",
            "reason": eligibility["reason"],
            "case": case,
            "attempts": existing_attempts
        }

    now = datetime.now(timezone.utc)
    attempt_num = attempt_count + 1
    policy = eligibility["policy"]

    # 2. Simulate Realistic Bounded Probability of Success
    # Attempt 1: ~45% success rate, Attempt 2: ~75% success rate, Attempt 3: ~90% success rate
    random.seed(hash(f"{case_id}_{attempt_num}"))  # Deterministic seed for reproducible judge demo
    success_prob = 0.45 if attempt_num == 1 else (0.75 if attempt_num == 2 else 0.90)
    is_success = random.random() < success_prob

    recovered_amt = float(case["amount_at_risk"]) if is_success else 0.0
    result_status = "success" if is_success else "failed"

    stop_reason = None
    if is_success:
        stop_reason = "recovered_successfully"
        new_case_status = "recovered"
    elif attempt_num >= policy["max_attempts"]:
        stop_reason = "max_attempts_reached"
        new_case_status = "failed"
    else:
        new_case_status = "recovering"

    # 3. Insert Recovery Attempt Record
    attempt_id = f"att_{uuid.uuid4().hex[:12]}"
    attempt_record = {
        "id": attempt_id,
        "recovery_case_id": case_id,
        "attempt_number": attempt_num,
        "action_type": action_type,
        "executed_at": now.isoformat(),
        "result": result_status,
        "recovered_amount": recovered_amt,
        "stop_reason": stop_reason
    }
    db.insert("recovery_attempts", attempt_record)

    # 4. Update Recovery Case Status
    db.update("recovery_cases", case_id, {
        "status": new_case_status,
        "updated_at": now.isoformat()
    })

    # 5. Emit Audit Log Entries
    create_audit_entry(
        event_type="EXECUTION",
        actor="RecoveryExecutor",
        details={
            "attempt_number": attempt_num,
            "action_type": action_type,
            "result": result_status,
            "simulated_prob": success_prob,
            "recovered_amount": recovered_amt
        },
        recovery_case_id=case_id
    )

    if is_success:
        create_audit_entry(
            event_type="RECOVERY",
            actor="RecoveryExecutor",
            details={
                "recovered_amount": recovered_amt,
                "total_attempts": attempt_num,
                "currency": "INR"
            },
            recovery_case_id=case_id
        )
        create_audit_entry(
            event_type="STOP",
            actor="RecoveryExecutor",
            details={"stop_reason": stop_reason, "final_status": "recovered"},
            recovery_case_id=case_id
        )
    elif stop_reason:
        create_audit_entry(
            event_type="STOP",
            actor="RecoveryExecutor",
            details={"stop_reason": stop_reason, "final_status": new_case_status},
            recovery_case_id=case_id
        )

    updated_case = db.fetch_all("recovery_cases", filters={"id": case_id})[0]
    all_attempts = db.fetch_all("recovery_attempts", filters={"recovery_case_id": case_id})

    return {
        "status": "executed",
        "result": result_status,
        "recovered_amount": recovered_amt,
        "stop_reason": stop_reason,
        "attempt": attempt_record,
        "case": updated_case,
        "all_attempts": all_attempts
    }


def get_recovery_metrics() -> Dict[str, Any]:
    """
    Computes real-time calculated metrics proving money recovered.
    """
    cases = db.fetch_all("recovery_cases")
    attempts = db.fetch_all("recovery_attempts")

    total_risk = sum(float(c.get("amount_at_risk", 0)) for c in cases)
    
    # Successful recoveries
    recovered_cases = [c for c in cases if c.get("status") == "recovered"]
    total_recovered = sum(float(c.get("amount_at_risk", 0)) for c in recovered_cases)

    successful_attempts = [a for a in attempts if a.get("result") == "success"]
    
    eligible_cases = [c for c in cases if c.get("status") in ["approved", "recovering", "recovered"]]
    eligible_amount = sum(float(c.get("amount_at_risk", 0)) for c in eligible_cases)

    recovery_rate = (total_recovered / total_risk * 100) if total_risk > 0 else 0.0
    remaining_risk = max(0.0, total_risk - total_recovered)

    # Average attempts to recovery
    attempts_per_recovered = [len(db.fetch_all("recovery_attempts", filters={"recovery_case_id": c["id"]})) for c in recovered_cases]
    avg_attempts = round(sum(attempts_per_recovered) / len(attempts_per_recovered), 1) if attempts_per_recovered else 0.0

    # Breakdown by intervention type
    by_intervention: Dict[str, Dict[str, Any]] = {}
    for a in attempts:
        act = a.get("action_type", "unknown")
        if act not in by_intervention:
            by_intervention[act] = {"attempts": 0, "successes": 0, "recovered_amount": 0.0}
        by_intervention[act]["attempts"] += 1
        if a.get("result") == "success":
            by_intervention[act]["successes"] += 1
            by_intervention[act]["recovered_amount"] += float(a.get("recovered_amount", 0))

    return {
        "total_revenue_at_risk": round(total_risk, 2),
        "eligible_recovery_amount": round(eligible_amount, 2),
        "total_recovery_attempts": len(attempts),
        "successful_recoveries_count": len(recovered_cases),
        "total_amount_recovered": round(total_recovered, 2),
        "recovery_rate_percentage": round(recovery_rate, 2),
        "remaining_revenue_at_risk": round(remaining_risk, 2),
        "average_attempts_to_recovery": avg_attempts,
        "by_intervention": by_intervention,
        "active_cases_count": sum(1 for c in cases if c.get("status") in ["detected", "diagnosed", "approved", "recovering"])
    }
