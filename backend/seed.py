import random
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List
from database import db

MERCHANT_ID = "mer_nexus_01"
MERCHANT_NAME = "Nexus Pay Solutions"

PAYMENT_METHODS = ["UPI", "card", "netbanking", "wallet"]
CHECKOUT_STAGES = ["cart", "address", "review", "payment", "otp"]
FAILURE_REASONS = [
    "bank_decline",
    "insufficient_funds",
    "timeout",
    "technical_error",
    "authentication_failed",
    "unknown",
]
CUSTOMER_SEGMENTS = ["VIP", "Regular", "New", "Enterprise"]


def seed_synthetic_data(reset: bool = True) -> Dict[str, Any]:
    """
    Idempotently seeds realistic 90-day synthetic dataset into database.
    
    Injected Patterns (NOT labeled as anomaly in records):
    1. Payment Degradation: Recent spike in UPI technical failures during 18:00 - 22:00 hours.
    2. Checkout Abandonment: Recent spike in abandoned checkouts at 'payment' & 'review' stages.
    """
    if reset:
        db.reset_all_tables()

    # Check if data already exists to ensure idempotency when reset is False
    existing_merchants = db.fetch_all("merchants", filters={"id": MERCHANT_ID})
    if existing_merchants and not reset:
        return {
            "status": "already_seeded",
            "message": "Database already seeded. Use reset=True to force re-seeding.",
            "mode": db.mode
        }

    random.seed(42)  # Seed for reproducible synthetic data distribution

    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=90)

    # 1. Create Merchant
    merchant = {
        "id": MERCHANT_ID,
        "name": MERCHANT_NAME,
        "currency": "INR",
        "created_at": (now - timedelta(days=120)).isoformat()
    }
    db.insert("merchants", merchant)

    # 2. Create 2,000 Customers
    customers: List[Dict[str, Any]] = []
    first_names = ["Aarav", "Ananya", "Rohan", "Priya", "Vikram", "Neha", "Rahul", "Sneha", "Aditya", "Kavya", "Amit", "Pooja", "Sanjay", "Meera", "Karan"]
    last_names = ["Sharma", "Verma", "Patel", "Rao", "Gupta", "Singh", "Nair", "Reddy", "Joshi", "Kumar", "Chopra", "Deshmukh", "Iyer", "Mehta"]

    for i in range(2000):
        c_id = f"cust_{i+1:04d}"
        fn = random.choice(first_names)
        ln = random.choice(last_names)
        c_time = start_date + timedelta(days=random.uniform(0, 75))
        customers.append({
            "id": c_id,
            "merchant_id": MERCHANT_ID,
            "name": f"{fn} {ln}",
            "email": f"{fn.lower()}.{ln.lower()}{i}@example.com",
            "customer_segment": random.choices(CUSTOMER_SEGMENTS, weights=[0.15, 0.50, 0.25, 0.10])[0],
            "created_at": c_time.isoformat()
        })

    db.insert_batch("customers", customers)

    # 3. Create 5,000+ Checkout Sessions
    checkout_sessions: List[Dict[str, Any]] = []
    num_checkouts = 5500
    recent_cutoff = now - timedelta(days=14)

    for i in range(num_checkouts):
        cs_id = f"cs_{i+1:05d}"
        cust = random.choice(customers)
        s_time = start_date + timedelta(seconds=random.uniform(0, 90 * 86400))
        is_recent = s_time >= recent_cutoff
        hour = s_time.hour

        # Base abandonment rate = ~20%. Recent period abandonment spike = ~38% (especially at payment stage)
        if is_recent:
            abandon_prob = 0.38
        else:
            abandon_prob = 0.20

        is_abandoned = random.random() < abandon_prob
        status = "abandoned" if is_abandoned else "converted"

        if is_abandoned:
            if is_recent:
                stage = random.choices(CHECKOUT_STAGES, weights=[0.10, 0.15, 0.35, 0.35, 0.05])[0]
            else:
                stage = random.choices(CHECKOUT_STAGES, weights=[0.30, 0.25, 0.20, 0.20, 0.05])[0]
        else:
            stage = "otp"

        pm = random.choices(PAYMENT_METHODS, weights=[0.55, 0.25, 0.12, 0.08])[0]
        cart_val = round(random.lognormvariate(7.5, 0.8), 2)  # realistic cart distribution ₹500 - ₹25,000
        cart_val = max(350.0, min(cart_val, 45000.0))

        checkout_sessions.append({
            "id": cs_id,
            "merchant_id": MERCHANT_ID,
            "customer_id": cust["id"],
            "started_at": s_time.isoformat(),
            "cart_amount": cart_val,
            "payment_method": pm,
            "stage": stage,
            "status": status,
            "last_event_at": (s_time + timedelta(minutes=random.randint(2, 25))).isoformat(),
            "recovery_eligible": is_abandoned and cart_val >= 1000.0,
            "recovery_status": "unrecovered" if is_abandoned else "n/a",
            "created_at": s_time.isoformat()
        })

    db.insert_batch("checkout_sessions", checkout_sessions)

    # 4. Create 8,500+ Transactions
    transactions: List[Dict[str, Any]] = []
    num_txns = 8500

    for i in range(num_txns):
        tx_id = f"txn_{i+1:05d}"
        cust = random.choice(customers)
        t_time = start_date + timedelta(seconds=random.uniform(0, 90 * 86400))
        is_recent = t_time >= recent_cutoff
        hour = t_time.hour
        pm = random.choices(PAYMENT_METHODS, weights=[0.55, 0.25, 0.12, 0.08])[0]

        # Injected Pattern 1: UPI evening hours (18:00 - 22:00) during recent 14 days experience elevated failure
        if is_recent and pm == "UPI" and 18 <= hour <= 22:
            failure_prob = 0.22  # High degradation rate (~22%)
            prob_tech_error = 0.75
        elif is_recent:
            failure_prob = 0.06
            prob_tech_error = 0.15
        else:
            failure_prob = 0.038  # Baseline normal failure rate (~3.8%)
            prob_tech_error = 0.12

        is_failed = random.random() < failure_prob
        tx_status = "failed" if is_failed else "success"

        if is_failed:
            if random.random() < prob_tech_error:
                reason = "technical_error"
            else:
                reason = random.choice(["bank_decline", "insufficient_funds", "timeout", "authentication_failed"])
        else:
            reason = None

        amt = round(random.lognormvariate(7.2, 0.75), 2)
        amt = max(200.0, min(amt, 35000.0))

        transactions.append({
            "id": tx_id,
            "merchant_id": MERCHANT_ID,
            "customer_id": cust["id"],
            "checkout_session_id": None,
            "amount": amt,
            "payment_method": pm,
            "status": tx_status,
            "failure_reason": reason,
            "created_at": t_time.isoformat()
        })

    db.insert_batch("transactions", transactions)

    return {
        "status": "success",
        "message": f"Successfully seeded 90-day dataset: 1 Merchant, {len(customers)} Customers, {len(checkout_sessions)} Checkout Sessions, {len(transactions)} Transactions.",
        "counts": {
            "merchants": 1,
            "customers": len(customers),
            "checkout_sessions": len(checkout_sessions),
            "transactions": len(transactions)
        },
        "mode": db.mode
    }


if __name__ == "__main__":
    res = seed_synthetic_data(reset=True)
    print(res)
