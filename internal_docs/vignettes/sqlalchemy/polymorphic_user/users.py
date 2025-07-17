"""
SQLAlchemy Polymorphic Inheritance Example

This script demonstrates single table inheritance (STI) in SQLAlchemy, a pattern where multiple
Python classes map to a single database table. The discriminator column (auth_method) determines
which class should be instantiated for a given row.

This implementation follows SQLAlchemy's Single Table Inheritance pattern as documented at:
https://docs.sqlalchemy.org/en/20/orm/inheritance.html#single-table-inheritance

Key Concepts:
1. Single Table Inheritance (STI): All user types share the same database table
2. Polymorphic Identity: Each subclass has a unique identifier in the auth_method column
3. Abstract Base Class: The User class cannot be instantiated directly
4. Discriminator Column: The auth_method column determines which subclass to instantiate

Security Considerations:
- Passwords are hashed using bcrypt with a unique salt per user
- The salt is stored separately from the password hash
- A global SECRET_KEY is available for additional security features
- Password fields are NULL for external users

Example Usage:
    # Create a local user
    local_user = LocalUser(email="user@example.com", password="secret")
    session.add(local_user)
    session.flush()

    # Create an external user
    external_user = ExternalUser(email="oauth@example.com")
    session.add(external_user)
    session.flush()

    # Query all users (returns both types)
    users = session.query(User).all()

    # Query specific type
    local_users = session.query(LocalUser).all()
"""

from __future__ import annotations

import secrets
from typing import Any, Literal, Optional

import bcrypt
from sqlalchemy import CheckConstraint, LargeBinary, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

# Global secret key for additional security
# This can be used for JWT signing, session tokens, or other cryptographic operations
# In production, consider using a secure secret management system
SECRET_KEY: str = secrets.token_urlsafe(32)


class Base(DeclarativeBase):
    """
    Base class for all SQLAlchemy models.
    This class provides the foundation for SQLAlchemy's declarative mapping system.
    """

    pass


# Type variable for auth method literals
# This ensures type safety when working with auth_method values
# Adding new auth methods requires updating this type
AuthMethod = Literal["local", "external"]


class User(Base):
    """
    Abstract base class for all user types.

    This class defines the common structure for all user types in the system.
    It cannot be instantiated directly and serves as a template for LocalUser and ExternalUser.

    The key to polymorphic inheritance is the __mapper_args__ configuration:
    - polymorphic_on: Specifies which column determines the subclass
    - polymorphic_identity: Set to None for abstract base classes

    Database Constraints:
    - email must be unique across all users
    - auth_method must be either 'local' or 'external'
    - password_hash and password_salt must be either both NULL or both have values

    Attributes:
        id: Primary key for the user record
        email: Unique email address for the user
        auth_method: Discriminator column that determines the user type ('local' or 'external')
        password_hash: Hashed password (only used by LocalUser)
        password_salt: Salt used for password hashing (only used by LocalUser)
    """

    __tablename__ = "users"

    # Primary key with auto-increment for SQLite
    # Using sqlite_autoincrement=True ensures sequential IDs even after deletions
    id: Mapped[int] = mapped_column(primary_key=True)

    # User identification field with uniqueness constraint
    # This ensures no two users can have the same email
    email: Mapped[str] = mapped_column(String, unique=True)

    # Discriminator column with check constraint
    # This column determines which subclass to instantiate
    # The check constraint ensures only valid auth methods are used
    auth_method: Mapped[AuthMethod] = mapped_column(
        String,
        CheckConstraint(
            "auth_method IN ('local', 'external')",
            name="valid_auth_method",
        ),
    )

    # Password fields are nullable since they're only used by LocalUser
    # Using LargeBinary for efficient storage of binary data
    # The check constraint ensures these fields are either both NULL or both have values
    password_hash: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    password_salt: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)

    # Configure polymorphic inheritance
    # This tells SQLAlchemy how to determine which subclass to instantiate
    __mapper_args__ = {
        "polymorphic_on": "auth_method",  # Use auth_method as discriminator
        "polymorphic_identity": None,  # Base class is abstract
    }

    # Table-level constraints
    # These ensure data integrity across the entire table
    __table_args__ = (
        # Ensure password fields are consistent
        CheckConstraint(
            "(password_hash IS NULL) = (password_salt IS NULL)",
            name="password_hash_and_salt",
        ),
        # Ensure sequential IDs in SQLite
        dict(sqlite_autoincrement=True),
    )

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
    It requires a password during creation and stores a hashed version using bcrypt.

    Security Features:
    - Passwords are hashed with bcrypt
    - Each user gets a unique salt
    - The salt is stored separately from the hash
    - Passwords are never stored in plain text

    The key to polymorphic inheritance is the __mapper_args__ configuration:
    - polymorphic_identity: Set to "local" to identify this subclass
    - When a row has auth_method="local", SQLAlchemy will instantiate this class

    Example:
        user = LocalUser(email="user@example.com", password="secret")
        session.add(user)
        session.flush()
    """

    __mapper_args__ = {
        "polymorphic_identity": "local",  # This is a local authentication user
    }

    def __init__(self, email: str, password: str) -> None:
        """
        Initialize a local user.

        Note: This __init__ is only called during object creation, not during database loading.
        As per SQLAlchemy documentation:
        "When loaded from the database, the operation used to construct the object is more analogous
        to deserialization, such as unpickling, rather than initial construction. The majority of
        the object's important state is not being assembled for the first time, it's being re-loaded
        from database rows." [1]

        This is safe because:
        1. During creation: __init__ is called and password gets hashed
        2. During database loading: SQLAlchemy bypasses __init__ and directly sets attributes
           (including the already-hashed password_hash and stored salt)

        [1] https://docs.sqlalchemy.org/en/20/orm/mapping_styles.html#orm-mapped-class-behavior

        Args:
            email: The user's email address
            password: The user's password (will be hashed with bcrypt before storage)
        """
        # Generate a new salt for this password
        # bcrypt.gensalt() automatically uses a secure random number generator
        password_salt = bcrypt.gensalt()
        # Hash password with bcrypt using the generated salt
        # bcrypt.hashpw() handles the password encoding and hashing
        password_hash = bcrypt.hashpw(password.encode(), password_salt)
        super().__init__(
            email=email,
            auth_method="local",  # This value determines which class to instantiate
            password_hash=password_hash,
            password_salt=password_salt,  # Store the salt separately
        )


class ExternalUser(User):
    """
    User who authenticates through external services (OAuth, SSO, etc.).

    This subclass represents users who authenticate through external identity providers.
    It doesn't require or store any password information.

    Security Features:
    - No password storage required
    - Authentication is delegated to external providers
    - Password fields are explicitly set to NULL

    The key to polymorphic inheritance is the __mapper_args__ configuration:
    - polymorphic_identity: Set to "external" to identify this subclass
    - When a row has auth_method="external", SQLAlchemy will instantiate this class

    Example:
        user = ExternalUser(email="oauth@example.com")
        session.add(user)
        session.flush()
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
            email=email,
            auth_method="external",  # This value determines which class to instantiate
        )


def main() -> None:
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

    Security Demonstrations:
    - Local users have properly hashed passwords with unique salts
    - External users have NULL password fields
    - The check constraint ensures password field consistency
    """
    # Create an in-memory SQLite database
    # This is for demonstration purposes only
    # In production, use a persistent database with proper configuration
    engine = create_engine("sqlite:///:memory:")

    # Create all tables
    # This sets up the database schema with all necessary constraints
    Base.metadata.create_all(engine)

    # Create a session
    with Session(engine) as session:
        # Start a transaction
        with session.begin():
            # Create a local user with password
            # The password will be hashed with a unique salt
            local_user = LocalUser(
                email="local@example.com",
                password="secure_password123",
            )
            session.add(local_user)

            # Create an external user
            # No password is required or stored
            external_user = ExternalUser(
                email="external@example.com",
            )
            session.add(external_user)

            # Try to create a base User (should fail)
            # This demonstrates that the abstract base class cannot be instantiated
            try:
                base_user = User(email="base@example.com")
                session.add(base_user)
                session.flush()  # This will raise the TypeError
            except TypeError as e:
                print(f"\nExpected error when creating base User: {e}")

    # Create a session
    with Session(engine) as session:
        # Start a transaction
        with session.begin():
            # Query all users (returns both LocalUser and ExternalUser instances)
            # This demonstrates polymorphic querying
            print("\nAll users:")
            users = session.query(User).all()
            for user in users:
                print(
                    f"Type: {type(user).__name__}, "
                    f"Email: {user.email}, "
                    f"Auth Method: {user.auth_method}"
                )

            # Query only local users
            # This demonstrates querying specific subclasses
            print("\nLocal users:")
            local_users = session.query(LocalUser).all()
            for user in local_users:
                print(f"Type: {type(user).__name__}, Email: {user.email}")

            # Query only external users
            # This demonstrates querying specific subclasses
            print("\nExternal users:")
            external_users = session.query(ExternalUser).all()
            for user in external_users:
                print(f"Type: {type(user).__name__}, Email: {user.email}")


if __name__ == "__main__":
    main()
