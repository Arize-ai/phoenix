from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(30), nullable=False)

    __table_args__ = (UniqueConstraint("name", name="projects_name_unique"),)

    def __repr__(self) -> str:
        return f"Project(id={self.id!r}, name={self.name!r})"
