"""LangGraph Workflow Compilation for Chatbot Service."""

from langgraph.graph import END, StateGraph
from graph.state import AgentState
from agents.knowledge_agent import knowledge_agent_node
from agents.commerce_agent import commerce_agent_node
from agents.health_agent import health_agent_node
from agents.supervisor import route_intent


def router_node(state: dict) -> str:
    """Multi-agent intent router via Supervisor classification engine."""
    messages = state.get("messages", [])
    query = messages[-1]["content"] if messages else ""
    return route_intent(query)


def build_chatbot_graph():
    """Build and compile the multi-agent LangGraph workflow."""
    workflow = StateGraph(AgentState)

    # Register Agent Nodes
    workflow.add_node("knowledge_agent", knowledge_agent_node)
    workflow.add_node("commerce_agent", commerce_agent_node)
    workflow.add_node("health_agent", health_agent_node)

    # Conditional Routing Entry Point
    workflow.set_conditional_entry_point(
        router_node,
        {
            "knowledge_agent": "knowledge_agent",
            "commerce_agent": "commerce_agent",
            "health_agent": "health_agent",
        },
    )

    workflow.add_edge("knowledge_agent", END)
    workflow.add_edge("commerce_agent", END)
    workflow.add_edge("health_agent", END)

    return workflow.compile()


chatbot_graph = build_chatbot_graph()
