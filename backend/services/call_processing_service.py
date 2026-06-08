import io
import os
import json
import logging
import re
from datetime import date

import boto3
import pandas as pd
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)


class CallProcessingError(Exception):
    """Raised when any step of the post-upload processing pipeline fails."""


# The analytics schema, in column order. A freshly extracted row is aligned to
# these fields, and a brand-new CSV is created with exactly these columns.
CALL_FIELDS = [
    "call_id",
    "employee_name",
    "team_name",
    "call_date",
    "product_name",
    "duration_seconds",
    "sale_result",
    "customer_intent",
    "main_objection",
    "customer_sentiment",
    "agent_performance_score",
    "objection_handling_quality",
    "closing_attempt",
    "call_summary",
    "missed_opportunity",
    "success_failure_reason",
    "recommended_improvement",
]


class CallProcessingService:
    """
    Runs the post-upload pipeline for a newly uploaded transcript:

      1. Extract structured metadata from the transcript via Claude (Bedrock).
      2. Append the extracted row to the metadata CSV stored in S3.
      3. Trigger a Knowledge Base ingestion job to re-sync the data source.
    """

    def __init__(self):
        self.region = os.getenv("AWS_REGION", "us-east-2")
        self.model_id = os.getenv("BEDROCK_MODEL_ID")
        self.metadata_bucket = os.getenv("METADATA_BUCKET")
        self.metadata_key = os.getenv("METADATA_KEY")
        self.kb_id = os.getenv("BEDROCK_KB_ID")
        self.ds_id = os.getenv("BEDROCK_DS_ID")

        missing = [
            name for name, value in {
                "BEDROCK_MODEL_ID": self.model_id,
                "METADATA_BUCKET": self.metadata_bucket,
                "METADATA_KEY": self.metadata_key,
                "BEDROCK_KB_ID": self.kb_id,
                "BEDROCK_DS_ID": self.ds_id,
            }.items() if not value
        ]
        if missing:
            raise CallProcessingError(
                "Missing required environment variables: " + ", ".join(missing)
            )

        try:
            self.bedrock = boto3.client("bedrock-runtime", region_name=self.region)
            self.s3 = boto3.client("s3", region_name=self.region)
            # StartIngestionJob lives on the control-plane "bedrock-agent" client,
            # not the runtime client used for invoke_model / invoke_agent.
            self.bedrock_agent = boto3.client("bedrock-agent", region_name=self.region)
        except (BotoCoreError, ClientError) as exc:
            logger.exception("Failed to create AWS clients for CallProcessingService")
            raise CallProcessingError(
                f"Could not initialise AWS clients: {exc}"
            ) from exc

        logger.info(
            "CallProcessingService ready (region=%s, model=%s, kb=%s)",
            self.region, self.model_id, self.kb_id,
        )

    # ------------------------------------------------------------------
    # Public orchestration
    # ------------------------------------------------------------------
    def process_transcript(self, transcript: str) -> dict:
        """
        Run the full pipeline for a transcript and return a summary dict:
        ``{"call_id": ..., "ingestion_job_id": ..., "metadata": {...}}``.
        """
        metadata = self.extract_metadata(transcript)
        call_id = str(metadata.get("call_id") or "").strip() or "UNKNOWN"

        self.append_to_metadata_csv(metadata)
        ingestion_job_id = self.start_ingestion_job()

        return {
            "call_id": call_id,
            "ingestion_job_id": ingestion_job_id,
            "metadata": metadata,
        }

    # ------------------------------------------------------------------
    # Step 1 — metadata extraction via Claude
    # ------------------------------------------------------------------
    def extract_metadata(self, transcript: str) -> dict:
        """Send the transcript to Claude and return the parsed metadata dict."""
        if not transcript or not transcript.strip():
            raise CallProcessingError("Transcript is empty; nothing to extract.")

        prompt = self._build_prompt(transcript)
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 2048,
            "temperature": 0,  # deterministic extraction
            "messages": [{"role": "user", "content": prompt}],
        })

        try:
            response = self.bedrock.invoke_model(
                modelId=self.model_id,
                body=body,
                contentType="application/json",
                accept="application/json",
            )
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "Unknown")
            msg = exc.response.get("Error", {}).get("Message", str(exc))
            raise CallProcessingError(
                f"Bedrock invoke_model failed ({code}): {msg}"
            ) from exc
        except BotoCoreError as exc:
            raise CallProcessingError(f"Bedrock connection error: {exc}") from exc

        try:
            payload = json.loads(response["body"].read())
            raw_text = payload["content"][0]["text"]
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
            raise CallProcessingError(
                f"Unexpected Bedrock response shape: {exc}"
            ) from exc

        return self._parse_json(raw_text)

    @staticmethod
    def _build_prompt(transcript: str) -> str:
        today = date.today().isoformat()
        fields = (
            "  call_id                    (string)\n"
            "  employee_name              (string)\n"
            "  team_name                  (string)\n"
            f"  call_date                  (string YYYY-MM-DD; use {today} if missing)\n"
            "  product_name               (string)\n"
            "  duration_seconds           (integer)\n"
            "  sale_result                (string: \"Sale\" or \"No Sale\")\n"
            "  customer_intent            (string)\n"
            "  main_objection             (string)\n"
            "  customer_sentiment         (string: \"Positive\", \"Neutral\", or \"Negative\")\n"
            "  agent_performance_score    (integer 1-5)\n"
            "  objection_handling_quality (integer 1-5)\n"
            "  closing_attempt            (string: \"yes\", \"weak\", or \"no\")\n"
            "  call_summary               (string: 2-3 sentences)\n"
            "  missed_opportunity         (string)\n"
            "  success_failure_reason     (string)\n"
            "  recommended_improvement    (string)\n"
        )
        return (
            "You are a sales-call analytics assistant. Analyze the transcript "
            "below and extract structured metadata.\n\n"
            "Return ONLY a single valid JSON object — no markdown fences, no "
            "preamble, no text before or after the JSON. Use exactly these "
            "field names:\n\n"
            f"{fields}\n"
            "Transcript:\n"
            f"{transcript}"
        )

    @staticmethod
    def _parse_json(text: str) -> dict:
        """Parse a JSON object from the model output, tolerating markdown fences."""
        text = text.strip()

        # Happy path: clean JSON.
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Fallback: strip ```json ... ``` fences / surrounding prose by grabbing
        # the outermost {...} block.
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass

        raise CallProcessingError(
            f"Could not parse JSON from model response. First 300 chars: {text[:300]!r}"
        )

    # ------------------------------------------------------------------
    # Step 2 — append row to the metadata CSV in S3
    # ------------------------------------------------------------------
    def append_to_metadata_csv(self, metadata: dict) -> None:
        """Download the metadata CSV, append the new row, and upload it back."""
        df = self._download_metadata_csv()

        # Align the new row to the existing column set (preserving order). If the
        # CSV is brand new, fall back to the canonical schema.
        columns = list(df.columns) if not df.empty or len(df.columns) else CALL_FIELDS
        new_row = {col: metadata.get(col, "") for col in columns}
        df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)

        buf = io.StringIO()
        df.to_csv(buf, index=False)

        try:
            self.s3.put_object(
                Bucket=self.metadata_bucket,
                Key=self.metadata_key,
                Body=buf.getvalue().encode("utf-8"),
                ContentType="text/csv",
            )
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "Unknown")
            raise CallProcessingError(
                f"Failed to upload metadata CSV ({code}) to "
                f"s3://{self.metadata_bucket}/{self.metadata_key}"
            ) from exc
        except BotoCoreError as exc:
            raise CallProcessingError(f"S3 connection error: {exc}") from exc

        logger.info(
            "Appended call %s to s3://%s/%s (%d rows total)",
            metadata.get("call_id", "?"), self.metadata_bucket,
            self.metadata_key, len(df),
        )

    def _download_metadata_csv(self) -> pd.DataFrame:
        """Return the existing metadata CSV as a DataFrame, or an empty one."""
        try:
            obj = self.s3.get_object(Bucket=self.metadata_bucket, Key=self.metadata_key)
            return pd.read_csv(io.BytesIO(obj["Body"].read()))
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code in ("NoSuchKey", "404"):
                logger.warning(
                    "Metadata CSV not found at s3://%s/%s; creating a new one.",
                    self.metadata_bucket, self.metadata_key,
                )
                return pd.DataFrame(columns=CALL_FIELDS)
            raise CallProcessingError(
                f"Failed to download metadata CSV ({code}) from "
                f"s3://{self.metadata_bucket}/{self.metadata_key}"
            ) from exc
        except BotoCoreError as exc:
            raise CallProcessingError(f"S3 connection error: {exc}") from exc

    # ------------------------------------------------------------------
    # Step 3 — trigger Knowledge Base ingestion
    # ------------------------------------------------------------------
    def start_ingestion_job(self) -> str:
        """Kick off a KB ingestion job and return the job id."""
        try:
            response = self.bedrock_agent.start_ingestion_job(
                knowledgeBaseId=self.kb_id,
                dataSourceId=self.ds_id,
                description="Auto-sync after transcript upload via Flask /upload",
            )
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "Unknown")
            msg = exc.response.get("Error", {}).get("Message", str(exc))
            raise CallProcessingError(
                f"StartIngestionJob failed ({code}): {msg}"
            ) from exc
        except BotoCoreError as exc:
            raise CallProcessingError(f"Bedrock connection error: {exc}") from exc

        job_id = response.get("ingestionJob", {}).get("ingestionJobId", "")
        logger.info("Started KB ingestion job %s", job_id)
        return job_id
