from datetime import datetime
from pydantic import BaseModel, Field

class BlogPostCreate(BaseModel):
    title: str = Field(max_length=300)
    slug: str = Field(max_length=300)
    excerpt: str | None = Field(default=None, max_length=300)
    content_html: str
    primary_keyword: str | None = Field(default=None, max_length=200)
    keywords: str | None = None
    meta_description: str | None = Field(default=None, max_length=200)
    status: str = Field(default="draft")

class BlogPostUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    slug: str | None = Field(default=None, max_length=300)
    excerpt: str | None = Field(default=None, max_length=300)
    content_html: str | None = None
    primary_keyword: str | None = Field(default=None, max_length=200)
    keywords: str | None = None
    meta_description: str | None = Field(default=None, max_length=200)
    status: str | None = None

class BlogPostResponse(BaseModel):
    id: int
    title: str
    slug: str
    excerpt: str | None = None
    content_html: str
    cover_image_url: str | None = None
    primary_keyword: str | None = None
    keywords: str | None = None
    meta_description: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None = None

    class Config:
        from_attributes = True

class BlogPostListItem(BaseModel):
    id: int
    title: str
    slug: str
    excerpt: str | None = None
    cover_image_url: str | None = None
    published_at: datetime | None = None

    class Config:
        from_attributes = True
