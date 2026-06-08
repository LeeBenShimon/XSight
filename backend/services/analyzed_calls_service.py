import io
import os
import json
import logging

import boto3
import pandas as pd
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)


class AnalyzedCallsServiceError(Exception):
    """Raised when the analyzed-calls metadata CSV cannot be read from S3."""


class AnalyzedCallsService:
    """Reads the analyzed-call metadata CSV from S3 and returns it as records."""

    def __init__(self):
        self.region = os.getenv("AWS_REGION", "us-east-2")
        self.bucket = os.getenv("METADATA_BUCKET")
        self.key = os.getenv("METADATA_KEY")

        missing = [name for name, value in {
            "METADATA_BUCKET": self.bucket,
            "METADATA_KEY": self.key,
        }.items() if not value]
        if missing:
            raise AnalyzedCallsServiceError(
                "Missing required environment variables: " + ", ".join(missing)
            )

        try:
            self.s3 = boto3.client("s3", region_name=self.region)
        except (BotoCoreError, ClientError) as exc:
            logger.exception("Failed to create S3 client for AnalyzedCallsService")
            raise AnalyzedCallsServiceError(
                f"Could not initialise S3 client: {exc}"
            ) from exc

        logger.info(
            "AnalyzedCallsService ready (region=%s, bucket=%s, key=%s)",
            self.region, self.bucket, self.key,
        )

    def list_calls(self) -> list:
        """Return every analyzed call as a list of JSON-safe dicts."""
        try:
            obj = self.s3.get_object(Bucket=self.bucket, Key=self.key)
            raw = obj["Body"].read()
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code in ("NoSuchKey", "404"):
                logger.warning(
                    "Metadata CSV not found at s3://%s/%s; returning empty list.",
                    self.bucket, self.key,
                )
                return []
            msg = exc.response.get("Error", {}).get("Message", str(exc))
            raise AnalyzedCallsServiceError(
                f"Failed to read metadata CSV ({code}): {msg}"
            ) from exc
        except BotoCoreError as exc:
            raise AnalyzedCallsServiceError(f"S3 connection error: {exc}") from exc

        try:
            df = pd.read_csv(io.BytesIO(raw))
        except Exception as exc:  # pandas raises several parse error types
            raise AnalyzedCallsServiceError(
                f"Failed to parse metadata CSV: {exc}"
            ) from exc

        # Trim whitespace on text columns (".str.strip()" leaves NaN untouched),
        # then serialise via pandas so NaN -> null and numpy scalar types become
        # native JSON types. json.loads gives plain dicts that jsonify accepts.
        for col in df.select_dtypes(include="object").columns:
            df[col] = df[col].str.strip()
        return json.loads(df.to_json(orient="records"))
