import os
import logging

import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)


class S3ServiceError(Exception):
    """Raised when an S3 operation fails."""


class S3FileNotFoundError(S3ServiceError):
    """Raised when a requested S3 object does not exist."""


class S3Service:
    """Thin wrapper around boto3 S3 for uploading call transcript files."""

    def __init__(self):
        self.region = os.getenv("AWS_REGION", "us-east-2")
        self.bucket = os.getenv("CALLS_BUCKET")

        if not self.bucket:
            raise S3ServiceError(
                "Environment variable CALLS_BUCKET is not set."
            )

        # Optional key prefix so uploads land alongside existing transcripts
        # (e.g. "transcripts/"). Normalised to end with exactly one slash.
        prefix = os.getenv("CALLS_PREFIX", "").strip().lstrip("/")
        if prefix and not prefix.endswith("/"):
            prefix += "/"
        self.prefix = prefix

        try:
            self.client = boto3.client("s3", region_name=self.region)
        except (BotoCoreError, ClientError) as exc:
            logger.exception("Failed to create S3 boto3 client")
            raise S3ServiceError(
                f"Could not initialise S3 client: {exc}"
            ) from exc

        logger.info(
            "S3Service ready (region=%s, bucket=%s)",
            self.region,
            self.bucket,
        )

    def upload_text_file(self, file_obj, key: str) -> str:
        """Stream a file object to S3 under ``key``; return the s3:// URI."""
        full_key = f"{self.prefix}{key}"
        try:
            self.client.upload_fileobj(
                file_obj,
                self.bucket,
                full_key,
                ExtraArgs={"ContentType": "text/plain"},
            )
        except ClientError as exc:
            logger.exception("S3 upload ClientError")
            msg = exc.response.get("Error", {}).get("Message", str(exc))
            raise S3ServiceError(f"S3 upload failed: {msg}") from exc
        except BotoCoreError as exc:
            logger.exception("S3 upload BotoCoreError")
            raise S3ServiceError(f"S3 connection error: {exc}") from exc

        return f"s3://{self.bucket}/{full_key}"

    def read_text_file(self, filename: str) -> str:
        """Return the UTF-8 text of a .txt object under the configured prefix."""
        full_key = f"{self.prefix}{filename}"
        try:
            obj = self.client.get_object(Bucket=self.bucket, Key=full_key)
            return obj["Body"].read().decode("utf-8")
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code in ("NoSuchKey", "404"):
                raise S3FileNotFoundError(
                    f"File not found: {full_key}"
                ) from exc
            msg = exc.response.get("Error", {}).get("Message", str(exc))
            raise S3ServiceError(f"S3 read failed: {msg}") from exc
        except BotoCoreError as exc:
            logger.exception("S3 read BotoCoreError")
            raise S3ServiceError(f"S3 connection error: {exc}") from exc

    def list_text_files(self) -> list:
        """Return metadata for all .txt files under the configured prefix, newest first."""
        paginator = self.client.get_paginator("list_objects_v2")
        files = []
        try:
            for page in paginator.paginate(Bucket=self.bucket, Prefix=self.prefix):
                for obj in page.get("Contents", []):
                    key = obj["Key"]
                    if not key.lower().endswith(".txt"):
                        continue
                    name = key[len(self.prefix):]
                    if not name:   # skip the prefix directory entry itself
                        continue
                    files.append({
                        "name": name,
                        "size": obj["Size"],
                        "last_modified": obj["LastModified"].isoformat(),
                    })
        except ClientError as exc:
            msg = exc.response.get("Error", {}).get("Message", str(exc))
            raise S3ServiceError(f"S3 list failed: {msg}") from exc
        except BotoCoreError as exc:
            raise S3ServiceError(f"S3 connection error: {exc}") from exc

        files.sort(key=lambda f: f["last_modified"], reverse=True)
        return files
