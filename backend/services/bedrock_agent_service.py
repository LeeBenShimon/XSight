import os
import uuid
import logging

import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)


class BedrockAgentServiceError(Exception):
    """Raised when the Bedrock Agent call fails."""


class BedrockAgentService:
    """Calls an Amazon Bedrock Agent via invoke_agent()."""

    def __init__(self):
        self.region = os.getenv("AWS_REGION", "us-east-2")
        self.agent_id = os.getenv("BEDROCK_AGENT_ID")
        self.agent_alias_id = os.getenv("BEDROCK_AGENT_ALIAS_ID")

        if not self.agent_id:
            raise BedrockAgentServiceError(
                "Environment variable BEDROCK_AGENT_ID is not set."
            )
        if not self.agent_alias_id:
            raise BedrockAgentServiceError(
                "Environment variable BEDROCK_AGENT_ALIAS_ID is not set."
            )

        try:
            self.client = boto3.client(
                "bedrock-agent-runtime", region_name=self.region
            )
        except (BotoCoreError, ClientError) as exc:
            logger.exception("Failed to create Bedrock Agent boto3 client")
            raise BedrockAgentServiceError(
                f"Could not initialise Bedrock Agent client: {exc}"
            ) from exc

        logger.info(
            "BedrockAgentService ready (region=%s, agent=%s, alias=%s)",
            self.region,
            self.agent_id,
            self.agent_alias_id,
        )

    def ask_question(self, question: str) -> dict:
        """Send a question to the Bedrock Agent and return answer + citations."""
        if not question or not question.strip():
            raise BedrockAgentServiceError("Question must not be empty.")
        question = question.strip()

        # Each call gets a unique session so conversations are independent.
        session_id = str(uuid.uuid4())

        try:
            response = self.client.invoke_agent(
                agentId=self.agent_id,
                agentAliasId=self.agent_alias_id,
                sessionId=session_id,
                inputText=question,
            )
        except ClientError as exc:
            logger.exception("Bedrock Agent invoke_agent ClientError")
            msg = exc.response.get("Error", {}).get("Message", str(exc))
            raise BedrockAgentServiceError(
                f"Bedrock Agent request failed: {msg}"
            ) from exc
        except BotoCoreError as exc:
            logger.exception("Bedrock Agent invoke_agent BotoCoreError")
            raise BedrockAgentServiceError(
                f"Bedrock Agent connection error: {exc}"
            ) from exc

        return self._collect_response(response, session_id)

    def _collect_response(self, response: dict, session_id: str) -> dict:
        """Consume the agent EventStream, assembling the answer and any citations."""
        answer_parts = []
        citations = []

        try:
            for event in response["completion"]:
                # Text chunks from the agent's final response
                chunk = event.get("chunk", {})
                if "bytes" in chunk:
                    answer_parts.append(chunk["bytes"].decode("utf-8"))

                # Knowledge Base references surfaced in orchestration traces
                trace = event.get("trace", {}).get("trace", {})
                obs = (
                    trace.get("orchestrationTrace", {})
                    .get("observation", {})
                )
                kb_output = obs.get("knowledgeBaseLookupOutput", {})
                for ref in kb_output.get("retrievedReferences", []):
                    snippet = ref.get("content", {}).get("text", "")
                    location = ref.get("location", {})
                    source = (
                        location.get("s3Location", {}).get("uri")
                        or location.get("type")
                        or "knowledge base"
                    )
                    citations.append({"text": snippet[:500], "source": source})

        except (KeyError, TypeError) as exc:
            logger.error("Unexpected Bedrock Agent response shape")
            raise BedrockAgentServiceError(
                "Bedrock Agent returned an unexpected response format."
            ) from exc

        answer = "".join(answer_parts)
        if not answer:
            raise BedrockAgentServiceError(
                "Bedrock Agent returned an empty response."
            )

        return {
            "answer": answer,
            "citations": citations,
            "session_id": session_id,
        }
