import re
import logging

from flask import Blueprint, request, jsonify

from backend.services.metadata_service import MetadataService, MetadataServiceError
from backend.services.analytics_service import AnalyticsService
from backend.services.bedrock_agent_service import BedrockAgentService, BedrockAgentServiceError

logger = logging.getLogger(__name__)

chat_bp = Blueprint("chat", __name__, url_prefix="/api")

# Lazy singletons — built once on first request, reused after.
_metadata = None
_analytics = None
_bedrock = None


def _get_services():
    """Construct (once) and return the three services."""
    global _metadata, _analytics, _bedrock
    if _metadata is None:
        _metadata = MetadataService()
        _analytics = AnalyticsService(_metadata)
    if _bedrock is None:
        _bedrock = BedrockAgentService()
    return _metadata, _analytics, _bedrock


# ----------------------------------------------------------------------
# Routing logic
# ----------------------------------------------------------------------
# Words that strongly signal a question wants a computed number/comparison.
_STAT_KEYWORDS = [
    "how many", "number of", "count", "total",
    "average", "avg", "mean",
    "win rate", "success rate", "conversion",
    "compare", "comparison", "versus", " vs ",
    "statistics", "stats", "breakdown", "summary",
    "most common", "top objection",
]


def _looks_statistical(question: str) -> bool:
    """Return True if the question appears to want computed statistics."""
    q = f" {question.lower()} "
    return any(kw in q for kw in _STAT_KEYWORDS)


def _route_statistical(question: str, metadata: MetadataService,
                       analytics: AnalyticsService) -> dict | None:
    """
    Handle a statistical question with the analytics layer.

    Returns a result dict, or None if we couldn't confidently map the
    question to a specific analytic (in which case the caller falls back
    to Bedrock).
    """
    q = question.lower()

    # Compare successful vs unsuccessful calls.
    if "compare" in q or "vs" in q or "versus" in q:
        if "success" in q or "fail" in q or "unsuccess" in q or "won" in q or "lost" in q:
            data = analytics.compare_success_vs_failure()
            return {
                "answer": _format_comparison(data),
                "data": data,
                "source_engine": "analytics",
            }

    # Per-agent summary, e.g. "how many calls did Daniel Cohen close?"
    for agent in metadata.list_agents():
        if agent.lower() in q:
            summary = analytics.agent_summary(agent)
            return {
                "answer": _format_agent_summary(summary),
                "data": summary,
                "source_engine": "analytics",
            }

    # Overall totals / win rate.
    if "win rate" in q or "success rate" in q or "conversion" in q:
        rate = analytics.overall_win_rate()
        counts = analytics.count_by_result()
        return {
            "answer": f"Overall win rate is {rate:.0%}. Result breakdown: {counts}.",
            "data": {"win_rate": rate, "counts": counts},
            "source_engine": "analytics",
        }

    if "how many" in q or "total" in q or "number of" in q or "count" in q:
        counts = analytics.count_by_result()
        total = analytics.total_calls()
        return {
            "answer": f"There are {total} calls in total. Breakdown by result: {counts}.",
            "data": {"total": total, "counts": counts},
            "source_engine": "analytics",
        }

    # Couldn't map to a specific analytic — let Bedrock try.
    return None


# ----------------------------------------------------------------------
# Formatters — turn analytics dicts into readable answer text
# ----------------------------------------------------------------------
def _format_agent_summary(s: dict) -> str:
    if s.get("total_calls", 0) == 0:
        return f"No calls found for {s.get('agent')}."
    return (
        f"{s['agent']} handled {s['total_calls']} calls: "
        f"{s['sales']} sales and {s['no_sales']} no-sales "
        f"(win rate {s['win_rate']:.0%}). "
        f"Average performance score {s['avg_performance_score']}, "
        f"average objection handling {s['avg_objection_handling']}."
    )


def _format_comparison(d: dict) -> str:
    s = d.get("successful", {})
    f = d.get("unsuccessful", {})
    if not s or not f:
        return "Not enough data to compare."
    return (
        f"Successful calls (n={s['count']}): avg duration "
        f"{s['avg_duration_seconds']}s, avg performance {s['avg_performance_score']}, "
        f"avg objection handling {s['avg_objection_handling']}, "
        f"top objection '{s['top_objection']}'.\n"
        f"Unsuccessful calls (n={f['count']}): avg duration "
        f"{f['avg_duration_seconds']}s, avg performance {f['avg_performance_score']}, "
        f"avg objection handling {f['avg_objection_handling']}, "
        f"top objection '{f['top_objection']}'."
    )


# ----------------------------------------------------------------------
# Endpoints
# ----------------------------------------------------------------------
@chat_bp.route("/chat", methods=["POST"])
def chat():
    if not request.is_json:
        return jsonify({"error": "Request body must be JSON."}), 400

    data = request.get_json(silent=True) or {}
    question = data.get("question", "")
    if not isinstance(question, str) or not question.strip():
        return jsonify({"error": "Field 'question' is required and must be non-empty."}), 400

    question = question.strip()

    try:
        metadata, analytics, bedrock = _get_services()
    except MetadataServiceError as exc:
        logger.error("Metadata init failed: %s", exc)
        return jsonify({"error": f"Data not available: {exc}"}), 500
    except BedrockAgentServiceError as exc:
        logger.error("Bedrock Agent init failed: %s", exc)
        return jsonify({"error": f"Bedrock Agent not available: {exc}"}), 502

    # 1. Try the analytics path if the question looks statistical.
    if _looks_statistical(question):
        try:
            result = _route_statistical(question, metadata, analytics)
            if result is not None:
                return jsonify(result), 200
        except Exception:  # noqa: BLE001 - never let analytics 500 the whole request
            logger.exception("Analytics path failed; falling back to Bedrock")

    # 2. Fall back to Bedrock RAG for everything else.
    try:
        result = bedrock.ask_question(question)
        result["source_engine"] = "bedrock"
        return jsonify(result), 200
    except BedrockAgentServiceError as exc:
        logger.warning("Bedrock Agent error: %s", exc)
        return jsonify({"error": str(exc)}), 502
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected error in /api/chat")
        return jsonify({"error": "An internal error occurred."}), 500


@chat_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200