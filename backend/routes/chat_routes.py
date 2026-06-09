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
_bedrock   = None


def _get_services():
    global _metadata, _analytics, _bedrock
    if _metadata is None:
        _metadata = MetadataService()
        _analytics = AnalyticsService(_metadata)
    if _bedrock is None:
        _bedrock = BedrockAgentService()
    return _metadata, _analytics, _bedrock


# ----------------------------------------------------------------------
# Statistical routing
# ----------------------------------------------------------------------
_STAT_KEYWORDS = [
    "how many", "number of", "count", "total",
    "average", "avg", "mean",
    "win rate", "success rate", "conversion",
    "compare", "comparison", "versus", " vs ",
    "statistics", "stats", "breakdown", "summary",
    "most common", "top objection",
]


def _looks_statistical(question: str) -> bool:
    q = f" {question.lower()} "
    return any(kw in q for kw in _STAT_KEYWORDS)


def _route_statistical(question: str, metadata: MetadataService,
                       analytics: AnalyticsService) -> dict | None:
    q = question.lower()

    # Per-agent summary — check before generic keywords.
    for agent in metadata.list_agents():
        if agent.lower() in q:
            summary = analytics.agent_summary(agent)
            return {
                "answer": _format_agent_summary(summary),
                "data": summary,
                "source_engine": "analytics",
            }

    # Compare successful vs unsuccessful calls.
    if "compare" in q or "vs" in q or "versus" in q:
        if any(kw in q for kw in ("success", "fail", "unsuccess", "won", "lost")):
            data = analytics.compare_success_vs_failure()
            return {
                "answer": _format_comparison(data),
                "data": data,
                "source_engine": "analytics",
            }

    # Overall win rate.
    if "win rate" in q or "success rate" in q or "conversion" in q:
        rate   = analytics.overall_win_rate()
        counts = analytics.count_by_result()
        return {
            "answer": f"Overall win rate is {rate:.0%}. Result breakdown: {counts}.",
            "data":   {"win_rate": rate, "counts": counts},
            "source_engine": "analytics",
        }

    # Total / count questions.
    if "how many" in q or "total" in q or "number of" in q or "count" in q:
        counts = analytics.count_by_result()
        total  = analytics.total_calls()
        return {
            "answer": f"There are {total} calls in total. Breakdown by result: {counts}.",
            "data":   {"total": total, "counts": counts},
            "source_engine": "analytics",
        }

    # Couldn't confidently map — fall through to Bedrock Agent.
    return None


# ----------------------------------------------------------------------
# Formatters
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

    # 1. Fast path: answer statistical questions locally.
    if _looks_statistical(question):
        try:
            result = _route_statistical(question, metadata, analytics)
            if result is not None:
                return jsonify(result), 200
        except Exception:  # noqa: BLE001
            logger.exception("Analytics path failed; falling back to Bedrock Agent")

    # 2. All other questions (and analytics fallthrough) go to the Agent.
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
