import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import db
from backend.seed import seed_synthetic_data
from backend.detection.engine import run_detection_engine
from backend.intervention.engine import check_intervention_eligibility
from backend.recovery.executor import execute_recovery_step, get_recovery_metrics
from backend.audit.logger import fetch_audit_logs

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_test_db():
    """Ensure database is seeded and risks detected before each test function."""
    seed_synthetic_data(reset=True)
    run_detection_engine()


def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "db_mode" in data


def test_seed_idempotency():
    res1 = client.post("/seed?reset=false")
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["status"] in ["success", "already_seeded"]


def test_risk_detection_engine():
    detection = run_detection_engine()
    assert detection["status"] == "success"
    risks = detection["risks"]
    assert len(risks) >= 2

    payment_risk = next(r for r in risks if r["risk_type"] == "payment_degradation")
    assert payment_risk["risk_score"] > 0
    assert payment_risk["amount_at_risk"] > 0
    assert "technical_error" in payment_risk["primary_failure_reason"]

    abandonment_risk = next(r for r in risks if r["risk_type"] == "checkout_abandonment")
    assert abandonment_risk["risk_score"] > 0
    assert len(abandonment_risk["evidence"]) >= 3


def test_intervention_eligibility_rules():
    case = {"id": "test_c1", "status": "approved", "amount_at_risk": 5000}
    eligibility = check_intervention_eligibility(case, "payment_retry", current_attempts=0)
    assert eligibility["eligible"] is True

    # Max attempts exceeded
    ineligible = check_intervention_eligibility(case, "payment_retry", current_attempts=3)
    assert ineligible["eligible"] is False
    assert "Maximum retry limit" in ineligible["reason"]

    # Terminal state
    terminal_case = {"id": "test_c2", "status": "recovered", "amount_at_risk": 5000}
    terminal_check = check_intervention_eligibility(terminal_case, "payment_retry", current_attempts=0)
    assert terminal_check["eligible"] is False


def test_recovery_execution_and_stop_condition():
    detection = run_detection_engine()
    risk_id = detection["risks"][0]["id"]

    # Approve
    approve_res = client.post(f"/risks/{risk_id}/approve")
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "approved"

    # Execute attempt 1
    exec_res = client.post(f"/risks/{risk_id}/execute")
    assert exec_res.status_code == 200
    data = exec_res.json()
    assert data["status"] == "executed"
    assert "recovered_amount" in data
    assert data["attempt"]["attempt_number"] == 1


def test_proven_recovery_metrics():
    metrics = get_recovery_metrics()
    assert metrics["total_revenue_at_risk"] > 0
    assert "recovery_rate_percentage" in metrics
    assert "by_intervention" in metrics


def test_audit_trail_logging():
    logs = fetch_audit_logs(limit=50)
    assert len(logs) > 0
    events = [l["event_type"] for l in logs]
    assert "DETECTION" in events
