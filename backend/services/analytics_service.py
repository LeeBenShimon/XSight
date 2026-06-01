import logging

import pandas as pd

from backend.services.metadata_service import MetadataService

logger = logging.getLogger(__name__)


class AnalyticsService:
    """Aggregation/statistics layer over the metadata DataFrame."""

    def __init__(self, metadata_service: MetadataService):
        # We depend on an existing MetadataService rather than loading the
        # CSV again — one source of truth, loaded once.
        self.metadata = metadata_service

    @property
    def _df(self) -> pd.DataFrame:
        return self.metadata.dataframe

    # ------------------------------------------------------------------
    # Basic counts
    # ------------------------------------------------------------------
    def total_calls(self) -> int:
        return int(len(self._df))

    def count_by_result(self) -> dict:
        """e.g. {'Sale': 9, 'No Sale': 11}"""
        return self._df["sale_result"].value_counts().to_dict()

    def overall_win_rate(self) -> float:
        """Fraction of calls that ended in a Sale, 0..1, rounded."""
        total = len(self._df)
        if total == 0:
            return 0.0
        sales = (self._df["sale_result"].str.lower() == "sale").sum()
        return round(sales / total, 3)

    # ------------------------------------------------------------------
    # Per-agent stats
    # ------------------------------------------------------------------
    def agent_summary(self, name: str) -> dict:
        """Per-agent total / sales / win rate / avg performance score."""
        rows = self._df[self._df["employee_name"].str.lower() == name.strip().lower()]
        total = len(rows)
        if total == 0:
            return {"agent": name, "total_calls": 0}

        sales = int((rows["sale_result"].str.lower() == "sale").sum())
        return {
            "agent": name,
            "total_calls": total,
            "sales": sales,
            "no_sales": total - sales,
            "win_rate": round(sales / total, 3),
            "avg_performance_score": round(
                float(rows["agent_performance_score"].mean()), 2
            ),
            "avg_objection_handling": round(
                float(rows["objection_handling_quality"].mean()), 2
            ),
        }

    def all_agents_summary(self) -> list[dict]:
        """agent_summary for every agent, sorted by win rate descending."""
        summaries = [self.agent_summary(a) for a in self.metadata.list_agents()]
        return sorted(summaries, key=lambda s: s.get("win_rate", 0), reverse=True)

    # ------------------------------------------------------------------
    # Comparisons
    # ------------------------------------------------------------------
    def compare_success_vs_failure(self) -> dict:
        """
        Compare successful vs unsuccessful calls across key numeric and
        categorical dimensions. Directly answers the project's
        'Compare successful and unsuccessful calls' question.
        """
        sale = self._df[self._df["sale_result"].str.lower() == "sale"]
        no_sale = self._df[self._df["sale_result"].str.lower() == "no sale"]

        def profile(group: pd.DataFrame) -> dict:
            if len(group) == 0:
                return {}
            return {
                "count": int(len(group)),
                "avg_duration_seconds": round(float(group["duration_seconds"].mean()), 1),
                "avg_performance_score": round(float(group["agent_performance_score"].mean()), 2),
                "avg_objection_handling": round(float(group["objection_handling_quality"].mean()), 2),
                "top_objection": (
                    group["main_objection"].mode().iloc[0]
                    if not group["main_objection"].mode().empty
                    else None
                ),
            }

        return {
            "successful": profile(sale),
            "unsuccessful": profile(no_sale),
        }

    # ------------------------------------------------------------------
    # Product stats
    # ------------------------------------------------------------------
    def product_summary(self) -> list[dict]:
        """Per-product totals and win rate."""
        out = []
        for product in self.metadata.list_products():
            rows = self._df[self._df["product_name"] == product]
            total = len(rows)
            sales = int((rows["sale_result"].str.lower() == "sale").sum())
            out.append(
                {
                    "product": product,
                    "total_calls": total,
                    "sales": sales,
                    "win_rate": round(sales / total, 3) if total else 0.0,
                }
            )
        return sorted(out, key=lambda p: p["win_rate"], reverse=True)