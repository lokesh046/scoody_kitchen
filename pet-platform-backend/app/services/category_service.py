from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryUpdate


class InvalidParentCategoryError(ValueError):
    pass


def _validate_parent(
    db: Session,
    parent_category_id: int | None,
    self_id: int | None,
) -> None:
    if parent_category_id is None:
        return

    if parent_category_id == self_id:
        raise InvalidParentCategoryError("A category cannot be its own parent")

    parent = db.get(Category, parent_category_id)
    if parent is None:
        raise InvalidParentCategoryError("Parent category does not exist")

    # One level of nesting only -- the parent itself must be top-level.
    # Keeps the tree at Main Category -> Subcategory, matching the browsing UI.
    if parent.parent_category_id is not None:
        raise InvalidParentCategoryError("Parent category must itself be a top-level category")


def create_category(
    db: Session,
    category_data: CategoryCreate,
)->  Category:

    _validate_parent(db, category_data.parent_category_id, self_id=None)

    category = Category(
        name=category_data.name,
        description=category_data.description,
        parent_category_id=category_data.parent_category_id,
    )

    db.add(category)
    db.commit()
    db.refresh(category)

    return category


def get_categories(
    db: Session,
) -> list[Category]:

    statement = select(Category).order_by(
        Category.name.asc()
    )

    return list(db.scalars(statement).all())


def get_category_tree(
    db: Session,
) -> list[Category]:
    """Top-level categories with their subcategories attached, in one query."""

    all_categories = get_categories(db)
    by_parent: dict[int | None, list[Category]] = {}
    for category in all_categories:
        by_parent.setdefault(category.parent_category_id, []).append(category)

    top_level = by_parent.get(None, [])
    for category in all_categories:
        category.children = by_parent.get(category.id, [])

    return top_level


def get_category_by_id(
    db: Session,
    category_id: int,
) -> Category | None:


    return db.get(Category, category_id)


def update_category(
    db: Session,
    category: Category,
    category_data: CategoryUpdate,
) -> Category:

    update_data = category_data.model_dump(
        exclude_unset=True
    )

    if "parent_category_id" in update_data:
        _validate_parent(db, update_data["parent_category_id"], self_id=category.id)

    for field, value in update_data.items():
        setattr(category, field, value)

    db.commit()
    db.refresh(category)

    return category


def delete_category(
    db: Session,
    category: Category,
) -> None:

    db.delete(category)
    db.commit()
