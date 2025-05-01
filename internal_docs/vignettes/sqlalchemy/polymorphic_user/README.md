# SQLAlchemy Polymorphic User Example

This vignette demonstrates SQLAlchemy's single table inheritance (STI) pattern through a practical example of user authentication. It shows how to model different types of users (local and external) in a single database table while maintaining type safety and clean code organization.

## Key Concepts Demonstrated

1. **Single Table Inheritance (STI)**
   - All user types share the same database table
   - A discriminator column (`auth_method`) determines which class to instantiate
   - Efficient storage while maintaining object-oriented design

2. **Polymorphic Identity**
   - Each subclass has a unique identifier in the `auth_method` column
   - SQLAlchemy automatically instantiates the correct class based on this value
   - Enables type-safe querying of specific user types

3. **Abstract Base Class**
   - The `User` class cannot be instantiated directly
   - Defines common structure and behavior for all user types
   - Enforces consistent interface across subclasses

## Code Structure

- `User`: Abstract base class defining common user attributes
- `LocalUser`: Subclass for users with local password authentication
- `ExternalUser`: Subclass for users authenticated through external services

## Usage Example

```python
# Create a local user
local_user = LocalUser(email="user@example.com", password="secret")

# Create an external user
external_user = ExternalUser(email="oauth@example.com")

# Query all users (returns both types)
users = session.query(User).all()

# Query specific type
local_users = session.query(LocalUser).all()
```

## Educational Focus

This example is designed to teach:
- How to implement STI in SQLAlchemy
- The benefits of polymorphic inheritance in database design
- How to maintain clean code organization with multiple user types
- Basic security practices for password storage

## Running the Example

1. Install dependencies:
   ```bash
   pip install sqlalchemy bcrypt
   ```

2. Run the example:
   ```bash
   python users.py
   ```

## Note on Security

This example includes basic password hashing for educational purposes. In a production environment, you would want to implement additional security measures such as:
- Rate limiting
- Password complexity requirements
- Account lockout policies
- Session management
- Additional authentication factors
