"""
Gemini-backed portfolio advisor chain, built on LangChain.

Mirrors the structure of services/binance/client.py (lazy init, module logger,
availability flag) but the underlying SDK call is natively async, so no
run_sync/executor bridge is needed here.
"""
import logging
from typing import Optional

from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

from core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ADVISOR_SYSTEM_PROMPT = (
    "You are VaultX's portfolio advisor. You are given a snapshot of the "
    "current user's own crypto holdings, trades, and profit/loss, formatted "
    "as plain text context below. Answer the user's question using ONLY "
    "that context - never invent holdings, prices, or trades that are not "
    "present in it. If the context shows no holdings, say so plainly instead "
    "of making something up. Be concise and factual. You are not a licensed "
    "financial advisor and must not present your answer as financial advice."
)

DISCLAIMER = (
    "This is an automated summary of your own portfolio data, not financial advice."
)


class GeminiClientManager:
    """Lazily builds a LangChain prompt | Gemini chat model chain."""

    def __init__(self):
        self.api_key: Optional[str] = settings.gemini_api_key
        self._chain = None

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    def _get_chain(self):
        if self._chain is None:
            if not self.available:
                raise RuntimeError("GEMINI_API_KEY is not configured")
            llm = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                google_api_key=self.api_key,
                temperature=0.2,
            )
            prompt = ChatPromptTemplate.from_messages([
                ("system", ADVISOR_SYSTEM_PROMPT),
                ("human", "{context}\n\nQuestion: {question}"),
            ])
            self._chain = prompt | llm
            logger.info("Gemini advisor chain initialized")
        return self._chain

    async def generate(self, context: str, question: str) -> str:
        chain = self._get_chain()
        result = await chain.ainvoke({"context": context, "question": question})
        return result.content


gemini_client = GeminiClientManager()
