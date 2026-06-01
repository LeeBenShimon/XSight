import os
import logging

import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)


class BedrockServiceError(Exception):
    """Raised when the Bedrock Knowledge Base call fails."""


class BedrockService:
    """Thin wrapper around Bedrock KB retrieve_and_generate."""

    def __init__(self):
        self.region = os.getenv("AWS_REGION", "us-east-2")
        self.knowledge_base_id = os.getenv("BEDROCK_KNOWLEDGE_BASE_ID")
        self.model_id = os.getenv(
            "BEDROCK_MODEL_ARN",
            f"arn:aws:bedrock:{self.region}::foundation-model/"
            "anthropic.claude-3-sonnet-20240229-v1:0",
        )
        self.num_results = int(os.getenv("BEDROCK_NUM_RESULTS", "5"))

        if not self.knowledge_base_id:
            raise BedrockServiceError(
                "Environment variable BEDROCK_KNOWLEDGE_BASE_ID is not set."
            )

        try:
            self.client = boto3.client(
                "bedrock-agent-runtime", region_name=self.region
            )
        except (BotoCoreError, ClientError) as exc:
            logger.exception("Failed to create Bedrock boto3 client")
            raise BedrockServiceError(
                f"Could not initialise Bedrock client: {exc}"
            ) from exc

        logger.info(
            "BedrockService ready (region=%s, kb=%s)",
            self.region,
            self.knowledge_base_id,
        )

    def ask_question(self, question: str) -> dict:
        """Send a question to the KB and return answer + citations."""
        if not question or not question.strip():
            raise BedrockServiceError("Question must not be empty.")
        question = question.strip()

        prompt_template = (
            "You are a sales-call analytics assistant. Answer the user's "
            "question using ONLY the information in the search results below. "
            "If the search results do not contain the answer, say the "
            "information is not available in the knowledge base.\n\n"
            "IMPORTANT INSTRUCTIONS:\n"
            "- When the user asks for examples or for calls matching a "
            "description, list EVERY call in the search results that is "
            "relevant, even if the factor they mention is only ONE of several "
            "reasons the call failed or succeeded. Do not omit borderline cases.\n"
            "- Always reference the specific call ID and employee name for each "
            "call you mention.\n"
            "- Be concise: one short paragraph or bullet per call.\n\n"
            "Search results:\n$search_results$\n\n"
            "User question: $query$"
        )
        config = {
            "type": "KNOWLEDGE_BASE",
            "knowledgeBaseConfiguration": {
                "knowledgeBaseId": self.knowledge_base_id,
                "modelArn": self.model_id,
                "retrievalConfiguration": {
                    "vectorSearchConfiguration": {
                        "numberOfResults": self.num_results
                    }
                },
                "generationConfiguration": {
                    "promptTemplate": {"textPromptTemplate": prompt_template}
                },
            },
        }

        try:
            response = self.client.retrieve_and_generate(
                input={"text": question},
                retrieveAndGenerateConfiguration=config,
            )
        except ClientError as exc:
            logger.exception("Bedrock retrieve_and_generate ClientError")
            msg = exc.response.get("Error", {}).get("Message", str(exc))
            raise BedrockServiceError(f"Bedrock request failed: {msg}") from exc
        except BotoCoreError as exc:
            logger.exception("Bedrock retrieve_and_generate BotoCoreError")
            raise BedrockServiceError(f"Bedrock connection error: {exc}") from exc

        return self._parse_response(response)

    @staticmethod
    def _parse_response(response: dict) -> dict:
        try:
            answer = response["output"]["text"]
        except (KeyError, TypeError) as exc:
            logger.error("Unexpected Bedrock response shape: %s", response)
            raise BedrockServiceError(
                "Bedrock returned an unexpected response format."
            ) from exc

        citations = []
        for citation in response.get("citations", []):
            for ref in citation.get("retrievedReferences", []):
                snippet = ref.get("content", {}).get("text", "")
                location = ref.get("location", {})
                source = (
                    location.get("s3Location", {}).get("uri")
                    or location.get("type")
                    or "knowledge base"
                )
                citations.append({"text": snippet[:500], "source": source})

        return {
            "answer": answer,
            "citations": citations,
            "session_id": response.get("sessionId"),
        }
    
    