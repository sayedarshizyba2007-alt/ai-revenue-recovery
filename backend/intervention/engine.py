from typing import Dict, Any


INTERVENTION_POLICIES = {
    "payment_retry": {
        "name": "Bounded Payment Retry",
        "description": "Retries failed transaction during off-peak gateway window",
        "max_attempts": 3,
        "retry_interval_hours": 2,
        "stop_conditions": ["payment_success", "max_attempts_reached", "recovery_window_expired"],
        "eligibility_rules": "Failed transaction with technical/decline error within 48h"
    },
    "alternate_payment_method_prompt": {
        "name": "Alternate Payment Method Prompt",
        "description": "Prompts customer to switch from failing UPI to Netbanking/Card",
        "max_attempts": 2,
        "retry_interval_hours": 4,
        "stop_conditions": ["payment_success", "user_dismissed", "max_attempts_reached"],
        "eligibility_rules": "UPI transaction failing due to gateway degradation"
    },
    "checkout_reminder": {
        "name": "Smart Checkout Reminder",
        "description": "Multi-channel reminder (Email/WhatsApp) with cart reservation link",
        "max_attempts": 2,
        "retry_interval_hours": 6,
        "stop_conditions": ["checkout_converted", "user_opt_out", "max_attempts_reached"],
        "eligibility_rules": "Abandoned checkout session with cart value >= INR 1,000"
    },
    "recovery_message": {
        "name": "Personalized Recovery Offer Message",
        "description": "Sends customer direct assistance message for high-value orders",
        "max_attempts": 2,
        "retry_interval_hours": 12,
        "stop_conditions": ["checkout_converted", "max_attempts_reached"],
        "eligibility_rules": "Enterprise/VIP customer segment abandonment"
    },
    "invoice_reminder": {
        "name": "Instant Invoice Payment Link",
        "description": "Dispatches direct Razorpay payment link for payment retry",
        "max_attempts": 2,
        "retry_interval_hours": 24,
        "stop_conditions": ["invoice_paid", "max_attempts_reached"],
        "eligibility_rules": "High cart value (> INR 10,000) payment decline"
    }
}


def check_intervention_eligibility(case: Dict[str, Any], action_type: str, current_attempts: int) -> Dict[str, Any]:
    """
    Validates whether an intervention is eligible under bounded policy constraints.
    """
    policy = INTERVENTION_POLICIES.get(action_type)
    if not policy:
        return {
            "eligible": False,
            "reason": f"Unknown action type: {action_type}"
        }

    status = case.get("status", "detected")
    if status in ["recovered", "stopped"]:
        return {
            "eligible": False,
            "reason": f"Case is already in terminal status '{status}'."
        }

    if current_attempts >= policy["max_attempts"]:
        return {
            "eligible": False,
            "reason": f"Maximum retry limit of {policy['max_attempts']} attempts reached for {action_type}."
        }

    return {
        "eligible": True,
        "policy": policy,
        "reason": "Intervention passes bounded safety constraints."
    }
