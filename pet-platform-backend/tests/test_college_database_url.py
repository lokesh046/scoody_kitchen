from app.core.college_database import build_college_db_url


def test_explicit_url_wins():
    assert build_college_db_url("postgresql://u:p@h/hearth", "postgresql://a:b@c/colleges") == "postgresql://a:b@c/colleges"


def test_neondb_is_swapped_for_college_db_when_no_override():
    assert build_college_db_url("postgresql://u:p@h/neondb?sslmode=require") == "postgresql://u:p@h/college_db?sslmode=require"


def test_other_database_names_are_left_alone_without_an_override():
    # This is the case that silently broke the colleges search when the main database was renamed.
    assert build_college_db_url("postgresql://u:p@h/hearth") == "postgresql://u:p@h/hearth"
