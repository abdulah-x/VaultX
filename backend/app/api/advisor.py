#!/usr/bin/env python3
"""
LLM Portfolio Q&A Advisor endpoint.

Stateless, single-turn: each request fetches a fresh snapshot of the user's
own holdings/trades/P&L (see services/ai/context.py) and asks Gemini
(via LangChain) to answer the question grounded in that context.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from core.dependencies import get_db, get_current_active_user
from core.errors import ExternalAPIError, ValidationError
from database import User
from services.ai.client import gemini_client, DISCLAIMER
from services.ai.context import build_portfolio_context

router = APIRouter()


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)


class ChatResponse(BaseModel):
    answer: str
    referenced_symbols: list[str]
    disclaimer: str


@router.post("/advisor/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_active_user),
    db=Depends(get_db),
):
    question = payload.question.strip()
    if not question:
        raise ValidationError("Question must not be empty")

    if not gemini_client.available:
        raise ExternalAPIError(
            "The portfolio advisor is not configured (missing GEMINI_API_KEY)."
        )

    context, referenced_symbols = build_portfolio_context(db, current_user.id)

    try:
        answer = await gemini_client.generate(context=context, question=question)
    except Exception as e:
        raise ExternalAPIError(
            "The portfolio advisor is temporarily unavailable.",
            details={"reason": str(e)},
        )

    return ChatResponse(
        answer=answer,
        referenced_symbols=referenced_symbols,
        disclaimer=DISCLAIMER,
    )
