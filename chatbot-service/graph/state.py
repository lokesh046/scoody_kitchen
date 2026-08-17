"""LangGraph AgentState schema for Chatbot Service."""

from typing import Annotated, Any, TypedDict
import operator


class AgentState(TypedDict):
    messages: Annotated[list[dict[str, Any]], operator.add]
    session_id: str
    user_id: int | None
    context_found: bool
    sources: list[str]
    pending_action: str | None
    pending_action_args: dict[str, Any] | None
    requires_confirmation: bool
    is_emergency: bool | None
