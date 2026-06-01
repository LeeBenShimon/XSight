import os
import logging

import pandas as pd

logger = logging.getLogger(__name__)


class MetadataServiceError(Exception):
    """Raised when the metadata CSV cannot be loaded or queried."""


class MetadataService:
    """In-memory query layer over the sales-call metadata CSV."""

    # The columns we expect in the CSV. Used to validate on load so we
    # fail loudly if the file is malformed, rather than later at query time.
    EXPECTED_COLUMNS = {
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
    }

    def __init__(self, csv_path: str | None = None):
        # Path defaults to data/metadata/sales_calls_metadata.csv, but can be
        # overridden via env var for tests / different environments.
        self.csv_path = csv_path or os.getenv(
            "METADATA_CSV_PATH",
            os.path.join("data", "metadata", "sales_calls_metadata.csv"),
        )
        self._df = self._load()

    # ------------------------------------------------------------------
    # Loading
    # ------------------------------------------------------------------
    def _load(self) -> pd.DataFrame:
        if not os.path.exists(self.csv_path):
            raise MetadataServiceError(
                f"Metadata CSV not found at '{self.csv_path}'."
            )
        try:
            df = pd.read_csv(self.csv_path)
        except Exception as exc:  # pandas can throw several error types
            raise MetadataServiceError(f"Failed to read CSV: {exc}") from exc

        # Normalise text columns: strip whitespace so " Sale" == "Sale".
        for col in df.select_dtypes(include="object").columns:
            df[col] = df[col].astype(str).str.strip()

        missing = self.EXPECTED_COLUMNS - set(df.columns)
        if missing:
            logger.warning("CSV is missing expected columns: %s", missing)

        logger.info("Loaded %d metadata rows from %s", len(df), self.csv_path)
        return df

    # ------------------------------------------------------------------
    # Query helpers — each returns a list of dicts (one dict per call row)
    # ------------------------------------------------------------------
    def all_calls(self) -> list[dict]:
        """Return every call as a list of dicts."""
        return self._df.to_dict(orient="records")

    def get_by_agent(self, name: str) -> list[dict]:
        """Calls handled by a given employee (case-insensitive match)."""
        mask = self._df["employee_name"].str.lower() == name.strip().lower()
        return self._df[mask].to_dict(orient="records")

    def get_by_result(self, result: str) -> list[dict]:
        """Calls with a given sale_result, e.g. 'Sale' or 'No Sale'."""
        mask = self._df["sale_result"].str.lower() == result.strip().lower()
        return self._df[mask].to_dict(orient="records")

    def get_by_product(self, product: str) -> list[dict]:
        """Calls for a given product (case-insensitive)."""
        mask = self._df["product_name"].str.lower() == product.strip().lower()
        return self._df[mask].to_dict(orient="records")

    def get_by_agent_and_result(self, name: str, result: str) -> list[dict]:
        """Calls for an agent filtered by result, e.g. Daniel Cohen + Sale."""
        mask = (
            (self._df["employee_name"].str.lower() == name.strip().lower())
            & (self._df["sale_result"].str.lower() == result.strip().lower())
        )
        return self._df[mask].to_dict(orient="records")
    
    

    # ------------------------------------------------------------------
    # Introspection helpers (used later by the router / analytics)
    # ------------------------------------------------------------------
    def list_agents(self) -> list[str]:
        """Unique employee names present in the data."""
        return sorted(self._df["employee_name"].dropna().unique().tolist())

    def list_products(self) -> list[str]:
        """Unique product names present in the data."""
        return sorted(self._df["product_name"].dropna().unique().tolist())

    @property
    def dataframe(self) -> pd.DataFrame:
        """Expose the underlying DataFrame for the analytics layer."""
        return self._df