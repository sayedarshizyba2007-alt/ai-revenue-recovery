import json
import logging
from typing import Dict, Any, List
from config import settings

logger = logging.getLogger("ai_diagnosis")


def diagnose_revenue_risk(risk_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Diagnoses detected revenue risk strictly using Google Gemini API (google-genai).
    
    Architecture Rules:
    1. Python calculates factual evidence first from database queries and passes it to Gemini.
    2. Gemini performs ALL AI reasoning, root cause diagnosis, confidence assignment, and intervention selection.
    3. Gemini returns structured JSON output.
    4. If GEMINI_API_KEY is unconfigured or API call fails, return an explicit 'AI_UNAVAILABLE' state.
       Do NOT fabricate fake AI output or claim Gemini generated something when it did not.
    """
    if not settings.is_gemini_configured:
        return {
            "ai_status": "AI_UNAVAILABLE",
            "ai_provider": "Gemini",
            "error": "GEMINI_API_KEY is unconfigured.",
            "message": "AI diagnosis requires GEMINI_API_KEY in environment variables.",
            "recommended_action": "payment_retry" if risk_data.get("risk_type") == "payment_degradation" else "checkout_reminder",
            "evidence_summary": risk_data.get("evidence", [])
        }

    try:
        return _call_gemini_api(risk_data)
    except Exception as e:
        logger.error(f"Gemini API invocation error: {str(e)}")
        return {
            "ai_status": "AI_UNAVAILABLE",
            "ai_provider": "Gemini",
            "error": f"Gemini API Error: {str(e)}",
            "message": "Failed to connect to Google Gemini API.",
            "recommended_action": "payment_retry" if risk_data.get("risk_type") == "payment_degradation" else "checkout_reminder",
            "evidence_summary": risk_data.get("evidence", [])
        }


def _call_gemini_api(risk_data: Dict[str, Any]) -> Dict[str, Any]:
    """Calls Google Gemini API using official google-genai or google.generativeai SDK."""
    prompt = f"""
    You are the FinTech AI Diagnostics & Recovery Engine for Razorpay AI Revenue Recovery (Track 03).
    Analyze the following structured revenue risk evidence detected by Python database calculations:

    Risk ID: {risk_data.get('id')}
    Risk Type: {risk_data.get('risk_type')}
    Title: {risk_data.get('title')}
    Risk Score: {risk_data.get('risk_score')}/100
    Amount at Risk: INR {risk_data.get('amount_at_risk')}
    Affected Volume: {risk_data.get('affected_count')}
    Baseline Rate: {risk_data.get('baseline_failure_rate', risk_data.get('baseline_abandonment_rate'))}%
    Recent Anomaly Rate: {risk_data.get('recent_failure_rate', risk_data.get('recent_abandonment_rate'))}%
    Concentrated Method/Stage: {risk_data.get('payment_method', risk_data.get('primary_abandonment_stage'))}
    Time Window: {risk_data.get('time_window', 'N/A')}
    Primary Failure Reason: {risk_data.get('primary_failure_reason', 'N/A')}

    Calculated Factual Evidence:
    {json.dumps(risk_data.get('evidence', []), indent=2)}

    CRITICAL CONSTRAINTS:
    1. All financial numbers must be grounded in the provided evidence. Do NOT alter amounts.
    2. Recommend ONE action from: "payment_retry", "checkout_reminder", "alternate_payment_method_prompt".
    3. Return ONLY valid JSON format matching the exact schema below:

    {{
      "diagnosis": "Detailed root cause hypothesis explaining the revenue drop",
      "root_cause": "Specific underlying technical/user friction mechanism",
      "recommended_action": "payment_retry" OR "checkout_reminder" OR "alternate_payment_method_prompt",
      "reasoning": "Clear explanation why this specific intervention is selected over alternatives",
      "confidence": 0.92,
      "priority": "HIGH" OR "MEDIUM" OR "LOW",
      "expected_recovery_logic": "Projected recovery percentage and financial outcome",
      "stop_conditions": ["payment_success", "max_attempts_reached"],
      "evidence_summary": ["Key evidence bullet 1", "Key evidence bullet 2"]
    }}
    """

    model_name = "gemini-2.5-flash"
    response_text = ""

    # Try official google.genai package
    try:
        from google import genai
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.generate_content(
            model=model_name,
            contents=prompt
        )
        response_text = response.text
    except Exception as exc:
        # Try google.generativeai fallback SDK
        try:
            import google.generativeai as genai_legacy
            genai_legacy.configure(api_key=settings.GEMINI_API_KEY)
            model = genai_legacy.GenerativeModel("gemini-1.5-flash")
            model_name = "gemini-1.5-flash"
            response = model.generate_content(prompt)
            response_text = response.text
        except Exception as legacy_exc:
            raise RuntimeError(f"SDK Invocation Failed: {str(exc)} | {str(legacy_exc)}")

    # Clean JSON response from markdown blocks if present
    cleaned_json = response_text.strip()
    if cleaned_json.startswith("```json"):
        cleaned_json = cleaned_json[7:]
    if cleaned_json.startswith("```"):
        cleaned_json = cleaned_json[3:]
    if cleaned_json.endswith("```"):
        cleaned_json = cleaned_json[:-3]
    cleaned_json = cleaned_json.strip()

    parsed = json.loads(cleaned_json)
    parsed["ai_status"] = "GEMINI_LIVE"
    parsed["ai_provider"] = "Gemini"
    parsed["model_used"] = model_name
    return parsed
