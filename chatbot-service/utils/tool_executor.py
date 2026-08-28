from enum import Enum
from typing import Any
import inspect

class ToolRisk(str, Enum):
    READ = "read"
    WRITE = "write"
    DESTRUCTIVE = "destructive"

# Define explicit risk classifications for each tool
TOOL_RISK_REGISTRY = {
    "get_order_status": ToolRisk.READ,
    "get_order_tracking": ToolRisk.READ,
    "get_my_orders": ToolRisk.READ,
    "search_products": ToolRisk.READ,
    "get_product_stock": ToolRisk.READ,
    "get_available_slots": ToolRisk.READ,
    "get_my_consultations": ToolRisk.READ,
    "get_my_pets": ToolRisk.READ,
    
    "book_consultation": ToolRisk.WRITE,
    
    "cancel_consultation": ToolRisk.DESTRUCTIVE,
    "cancel_order": ToolRisk.DESTRUCTIVE,
}

def get_tool_risk(tool_name: str) -> ToolRisk:
    """Resolve and return risk level of a tool by name."""
    # Normalize tool names (remove prefixed 'tool_')
    normalized = tool_name.replace("tool_", "")
    return TOOL_RISK_REGISTRY.get(normalized, ToolRisk.READ)

async def execute_tool(tool_fn: Any, args: dict[str, Any], context: dict[str, Any] | None = None) -> Any:
    """Central bottleneck for tool execution.
    
    Validates risk level, enforces HITL authorization constraints, and executes the tool.
    """
    tool_name = getattr(tool_fn, "name", str(tool_fn))
    risk = get_tool_risk(tool_name)
    
    context = context or {}
    is_hitl_approved = context.get("is_hitl_approved", False)
    
    if risk in (ToolRisk.WRITE, ToolRisk.DESTRUCTIVE) and not is_hitl_approved:
        raise PermissionError(
            f"Direct execution of write/destructive tool '{tool_name}' is forbidden. "
            "All state-changing actions must be authorized via human-in-the-loop (HITL) confirmation."
        )
        
    # Safely invoke the tool
    if hasattr(tool_fn, "ainvoke"):
        res = tool_fn.ainvoke(args)
        if inspect.isawaitable(res):
            return await res
        return res
    return tool_fn.invoke(args)
