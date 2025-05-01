"""
SQLAlchemy Polymorphic Inheritance Example

This script demonstrates single table inheritance (STI) in SQLAlchemy, a pattern where multiple
Python classes map to a single database table. The discriminator column (auth_method) determines
which class should be instantiated for a given row.

Key Concepts:
1. Single Table Inheritance (STI): All user types share the same database table
2. Polymorphic Identity: Each subclass has a unique identifier in the auth_method column
3. Abstract Base Class: The User class cannot be instantiated directly
4. Discriminator Column: The auth_method column determines which subclass to instantiate

Example Usage:
    # Create a local user
    local_user = LocalUser(email="user@example.com", password="secret")

    # Create an external user
    external_user = ExternalUser(email="oauth@example.com")

    # Query all users (returns both types)
    users = session.query(User).all()

    # Query specific type
    local_users = session.query(LocalUser).all()
"""

import hashlib
from typing import Any, Literal, Optional

from sqlalchemy import CheckConstraint, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column


class Base(DeclarativeBase):
    """
    Base class for all SQLAlchemy models.
    This class provides the foundation for SQLAlchemy's declarative mapping system.
    """

    pass


class User(Base):
    """
    Abstract base class for all user types.

    This class defines the common structure for all user types in the system.
    It cannot be instantiated directly and serves as a template for LocalUser and ExternalUser.

    The key to polymorphic inheritance is the __mapper_args__ configuration:
    - polymorphic_on: Specifies which column determines the subclass
    - polymorphic_identity: Set to None for abstract base classes

    Attributes:
        id: Primary key for the user record
        email: Unique email address for the user
        auth_method: Discriminator column that determines the user type ('local' or 'external')
        password_hash: Hashed password (only used by LocalUser)
    """

    __tablename__ = "users"

    # Primary key with auto-increment for SQLite
    id: Mapped[int] = mapped_column(primary_key=True)

    # User identification field with uniqueness constraint
    email: Mapped[str] = mapped_column(String, unique=True)

    # Discriminator column with check constraint
    # This column determines which subclass to instantiate
    auth_method: Mapped[Literal["local", "external"]] = mapped_column(
        String,
        CheckConstraint(
            "auth_method IN ('local', 'external')",
            name="valid_auth_method",
        ),
    )

    # Password field (nullable since it's only used by LocalUser)
    password_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Configure polymorphic inheritance
    __mapper_args__ = {
        "polymorphic_on": "auth_method",  # Use auth_method as discriminator
        "polymorphic_identity": None,  # Base class is abstract
    }

    def __init__(self, **kwargs: Any) -> None:
        """
        Initialize a new user.

        This method prevents direct instantiation of the abstract User class.
        Only subclasses (LocalUser and ExternalUser) can be instantiated.

        Args:
            **kwargs: Attributes to set on the user

        Raises:
            TypeError: If attempting to instantiate the abstract User class directly
        """
        if self.__class__ is User:
            raise TypeError("Cannot instantiate abstract User class")
        super().__init__(**kwargs)

    def __repr__(self) -> str:
        """Return a string representation of the user."""
        return f"<{self.__class__.__name__}(email='{self.email}')>"


class LocalUser(User):
    """
    User who authenticates with local credentials.

    This subclass represents users who authenticate with an email and password.
    It requires a password during creation and stores a hashed version.

    The key to polymorphic inheritance is the __mapper_args__ configuration:
    - polymorphic_identity: Set to "local" to identify this subclass
    - When a row has auth_method="local", SQLAlchemy will instantiate this class

    Example:
        user = LocalUser(email="user@example.com", password="secret")
        session.add(user)
        session.commit()
    """

    __mapper_args__ = {
        "polymorphic_identity": "local",  # This is a local authentication user
    }

    def __init__(self, email: str, password: str) -> None:
        """
        Initialize a new local user with a password.

        Args:
            email: The user's email address
            password: The user's password (will be hashed before storage)
        """
        # Simple password hashing for demonstration
        password_hash = hashlib.sha256(password.encode()).hexdigest()

        super().__init__(
            email=email,
            auth_method="local",  # This value determines which class to instantiate
            password_hash=password_hash,
        )

    def verify_password(self, password: str) -> bool:
        """
        Verify if the provided password matches the stored hash.

        Args:
            password: The password to verify

        Returns:
            True if the password matches, False otherwise
        """
        if not self.password_hash:
            return False

        # Hash the provided password and compare
        provided_hash = hashlib.sha256(password.encode()).hexdigest()
        return provided_hash == self.password_hash


class ExternalUser(User):
    """
    User who authenticates through external services (OAuth, SSO, etc.).

    This subclass represents users who authenticate through external identity providers.
    It doesn't require or store any password information.

    The key to polymorphic inheritance is the __mapper_args__ configuration:
    - polymorphic_identity: Set to "external" to identify this subclass
    - When a row has auth_method="external", SQLAlchemy will instantiate this class

    Example:
        user = ExternalUser(email="oauth@example.com")
        session.add(user)
        session.commit()
    """

    __mapper_args__ = {
        "polymorphic_identity": "external",  # This is an external authentication user
    }

    def __init__(self, email: str) -> None:
        """
        Initialize a new external user.

        Args:
            email: The user's email address
        """
        super().__init__(
            email=email, auth_method="external"
        )  # This value determines which class to instantiate


def main():
    """
    Demonstrate the usage of polymorphic inheritance.

    This function shows how to:
    1. Create different types of users (LocalUser and ExternalUser)
    2. Store them in the same database table
    3. Query them using both the base class and specific subclasses
    4. Handle polymorphic instantiation based on the discriminator column

    The key points demonstrated are:
    - All users are stored in the same table
    - The auth_method column determines which class to instantiate
    - Queries can return mixed types of users
    - The base User class cannot be instantiated directly
    """
    # Create an in-memory SQLite database
    engine = create_engine("sqlite:///:memory:")

    # Create all tables
    Base.metadata.create_all(engine)

    # Create a session
    with Session(engine) as session:
        # Start a transaction
        with session.begin():
            # Create a local user with password
            local_user = LocalUser(
                email="local@example.com",
                password="secure_password123",
            )
            session.add(local_user)

            # Create an external user
            external_user = ExternalUser(
                email="external@example.com",
            )
            session.add(external_user)

            # Flush the session to see the state before commit
            session.flush()

            # Show the session state after flush
            print("\nSession state after flush:")
            print(f"New objects: {session.new}")
            print(f"Dirty objects: {session.dirty}")
            print(f"Deleted objects: {session.deleted}")

            # Try to create a base User (should fail)
            try:
                base_user = User(email="base@example.com")
                session.add(base_user)
                session.flush()  # This will raise the TypeError
            except TypeError as e:
                print(f"\nExpected error when creating base User: {e}")

            # The transaction will automatically commit here if no exceptions occurred

        # Query all users (returns both LocalUser and ExternalUser instances)
        print("\nAll users:")
        users = session.query(User).all()
        for user in users:
            print(
                f"Type: {type(user).__name__}, "
                f"Email: {user.email}, "
                f"Auth Method: {user.auth_method}"
            )

        # Query only local users
        print("\nLocal users:")
        local_users = session.query(LocalUser).all()
        for user in local_users:
            print(f"Type: {type(user).__name__}, Email: {user.email}")

            # Demonstrate password verification
            print("\nPassword verification:")
            print(f"Correct password: {user.verify_password('secure_password123')}")
            print(f"Incorrect password: {user.verify_password('wrong_password')}")

        # Query only external users
        print("\nExternal users:")
        external_users = session.query(ExternalUser).all()
        for user in external_users:
            print(f"Type: {type(user).__name__}, Email: {user.email}")


if __name__ == "__main__":
    main()
