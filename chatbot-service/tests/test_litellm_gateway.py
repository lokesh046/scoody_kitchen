import sys
import os
import pytest
from unittest.mock import MagicMock

# Ensure chatbot-service is in sys.path
service_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if service_dir not in sys.path:
    sys.path.insert(0, service_dir)

from utils.llm_gateway import LiteLLMGateway, get_llm_with_fallback
from utils.rate_limiter import LangChainTokenCostCallbackHandler


def test_litellm_completion_cost_calculation():
    # Test LiteLLM cost calculation for Gemini Flash
    cost = LiteLLMGateway.calculate_completion_cost(
        model="gemini/gemini-2.5-flash",
        prompt_tokens=1000,
        completion_tokens=500,
    )
    assert isinstance(cost, float)
    assert cost > 0.0


def test_litellm_token_cost_callback_integration():
    cb = LangChainTokenCostCallbackHandler(
        session_id="test_litellm_sess",
        model_name="gemini/gemini-2.5-flash",
    )
    assert cb.estimated_cost_usd == 0.0

    mock_response = MagicMock()
    mock_response.llm_output = {
        "token_usage": {
            "prompt_tokens": 2000,
            "completion_tokens": 1000,
            "total_tokens": 3000,
        }
    }

    cb.on_llm_end(mock_response)
    assert cb.prompt_tokens == 2000
    assert cb.completion_tokens == 1000
    assert cb.estimated_cost_usd > 0.0


def test_litellm_gateway_langchain_runnable_builder():
    llm = get_llm_with_fallback(
        model_name="gemini/gemini-2.5-flash",
        fallback_model_name="gemini/gemini-1.5-flash",
    )
    assert llm is not None
    assert hasattr(llm, "invoke")
