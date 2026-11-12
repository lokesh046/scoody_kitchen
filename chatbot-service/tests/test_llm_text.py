from utils.llm_text import content_to_text


def test_block_list_becomes_plain_text():
    blocks = [{"type": "text", "text": "If my dog has a clinical issue", "extras": {"signature": "abc"}}]
    assert content_to_text(blocks) == "If my dog has a clinical issue"


def test_plain_string_none_and_mixed_blocks():
    assert content_to_text("  hello ") == "hello"
    assert content_to_text(None) == ""
    assert content_to_text(["a", {"text": "b"}]) == "ab"
