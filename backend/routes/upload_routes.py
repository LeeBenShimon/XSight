import io
import re
import logging

from flask import Blueprint, request, jsonify, Response
from werkzeug.utils import secure_filename

from backend.services.s3_service import (
    S3Service,
    S3ServiceError,
    S3FileNotFoundError,
)
from backend.services.call_processing_service import (
    CallProcessingService,
    CallProcessingError,
)
from backend.services.analyzed_calls_service import (
    AnalyzedCallsService,
    AnalyzedCallsServiceError,
)

logger = logging.getLogger(__name__)

upload_bp = Blueprint("upload", __name__)

# Lazy singletons — built once on first use, reused after.
_s3 = None
_processor = None
_analyzed = None


def _get_s3() -> S3Service:
    global _s3
    if _s3 is None:
        _s3 = S3Service()
    return _s3


def _get_processor() -> CallProcessingService:
    global _processor
    if _processor is None:
        _processor = CallProcessingService()
    return _processor


def _get_analyzed() -> AnalyzedCallsService:
    global _analyzed
    if _analyzed is None:
        _analyzed = AnalyzedCallsService()
    return _analyzed


@upload_bp.route("/upload", methods=["POST"])
def upload():
    # 1. Must be a multipart form carrying a "file" part.
    if "file" not in request.files:
        return jsonify({"error": "No file part in the request."}), 400

    file = request.files["file"]
    if not file or not file.filename:
        return jsonify({"error": "No file selected."}), 400

    # 2. Only .txt files are accepted.
    if not file.filename.lower().endswith(".txt"):
        return jsonify({"error": "Only .txt files are allowed."}), 400

    filename = secure_filename(file.filename) or "upload.txt"

    # Read the file once: the bytes go to S3, the decoded text feeds extraction.
    raw = file.read()
    try:
        transcript = raw.decode("utf-8")
    except UnicodeDecodeError:
        return jsonify({"error": "File must be UTF-8 encoded text."}), 400

    # 3. Save the raw transcript to S3 (unchanged behaviour).
    try:
        s3 = _get_s3()
    except S3ServiceError as exc:
        logger.error("S3 init failed: %s", exc)
        return jsonify({"error": f"Upload service not available: {exc}"}), 503

    try:
        location = s3.upload_text_file(io.BytesIO(raw), filename)
    except S3ServiceError as exc:
        logger.warning("S3 upload error: %s", exc)
        return jsonify({"error": str(exc)}), 502
    except Exception:  # noqa: BLE001 - never leak internals to the client
        logger.exception("Unexpected error in /upload")
        return jsonify({"error": "An internal error occurred."}), 500

    # 4. Process the transcript: extract metadata → append CSV → sync the KB.
    #    The file is already safely in S3 at this point; if processing fails we
    #    report it but the upload itself is not rolled back.
    try:
        processor = _get_processor()
    except CallProcessingError as exc:
        logger.error("Processing service init failed: %s", exc)
        return jsonify({
            "error": f"File uploaded, but processing is unavailable: {exc}",
            "location": location,
        }), 503

    try:
        result = processor.process_transcript(transcript)
    except CallProcessingError as exc:
        logger.warning("Processing pipeline error: %s", exc)
        return jsonify({
            "error": f"File uploaded, but processing failed: {exc}",
            "location": location,
        }), 502
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected error during transcript processing")
        return jsonify({
            "error": "File uploaded, but an internal error occurred during processing.",
            "location": location,
        }), 500

    return jsonify({
        "success": True,
        "status": "ok",
        "message": f"Uploaded and processed {filename} successfully.",
        "location": location,
        "call_id": result["call_id"],
        "ingestion_job_id": result["ingestion_job_id"],
        "metadata": result["metadata"],
    }), 201


@upload_bp.route("/api/calls", methods=["GET"])
def list_calls():
    try:
        s3 = _get_s3()
    except S3ServiceError as exc:
        logger.error("S3 init failed: %s", exc)
        return jsonify({"error": f"Storage service not available: {exc}"}), 503

    try:
        files = s3.list_text_files()
    except S3ServiceError as exc:
        logger.warning("S3 list error: %s", exc)
        return jsonify({"error": str(exc)}), 502
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected error in /api/calls")
        return jsonify({"error": "An internal error occurred."}), 500

    return jsonify(files), 200


# call_id values look like "CALL_001" — restrict to safe chars to prevent any
# path traversal into the bucket via the URL.
_CALL_ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")


@upload_bp.route("/api/calls/<call_id>/transcript", methods=["GET"])
def call_transcript(call_id):
    """Return the raw transcript text for a given call id from S3."""
    if not _CALL_ID_RE.match(call_id):
        return jsonify({"error": "Invalid call id."}), 400

    try:
        s3 = _get_s3()
    except S3ServiceError as exc:
        logger.error("S3 init failed: %s", exc)
        return jsonify({"error": f"Storage service not available: {exc}"}), 503

    try:
        text = s3.read_text_file(f"{call_id}.txt")
    except S3FileNotFoundError:
        return jsonify({"error": f"Transcript not found for {call_id}."}), 404
    except S3ServiceError as exc:
        logger.warning("S3 read error: %s", exc)
        return jsonify({"error": str(exc)}), 502
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected error in /api/calls/<id>/transcript")
        return jsonify({"error": "An internal error occurred."}), 500

    return Response(text, mimetype="text/plain")


@upload_bp.route("/api/analyzed-calls", methods=["GET"])
def analyzed_calls():
    """Return the analyzed-call metadata (CSV in S3) as a JSON array."""
    try:
        svc = _get_analyzed()
    except AnalyzedCallsServiceError as exc:
        logger.error("Analyzed-calls init failed: %s", exc)
        return jsonify({"error": f"Service not available: {exc}"}), 503

    try:
        calls = svc.list_calls()
    except AnalyzedCallsServiceError as exc:
        logger.warning("Analyzed-calls read error: %s", exc)
        return jsonify({"error": str(exc)}), 502
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected error in /api/analyzed-calls")
        return jsonify({"error": "An internal error occurred."}), 500

    return jsonify(calls), 200
