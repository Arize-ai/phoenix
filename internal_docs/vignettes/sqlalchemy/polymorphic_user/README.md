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

4. **Security Implementation**
   - Password hashing using bcrypt with unique salts
   - Separate storage of password hashes and salts
   - Type-safe authentication method handling
   - Database constraints for data integrity

## Initialization Behavior

SQLAlchemy's ORM has a unique approach to object initialization that's important to understand:

1. **Object Creation vs Database Loading**
   - During object creation (e.g., `LocalUser(email="user@example.com", password="secret")`):
     - The `__init__` method is called
     - Password hashing and salt generation occur
     - Attributes are set through the constructor
   - During database loading (e.g., `session.query(User).all()`):
     - SQLAlchemy bypasses `__init__`
     - Attributes are set directly from database rows
     - This is more like deserialization than construction

2. **Polymorphic Loading**
   - The `auth_method` discriminator determines which class to instantiate
   - SQLAlchemy automatically selects the correct subclass
   - All attributes are set directly from the database row

3. **State Management**
   - Non-mapped state (like computed properties) can be maintained using:
     - Python descriptors (`@property`)
     - Event hooks (`InstanceEvents.load()`)
   - In this example, `auth_method` is computed based on password fields

This behavior ensures that:
- Password hashing only occurs during object creation
- Database loading is efficient and direct
- Polymorphic inheritance works seamlessly

## Code Structure

- `User`: Abstract base class defining common user attributes
  - Type-safe `auth_method` discriminator
  - Password fields with check constraints
  - Database-level integrity checks

- `LocalUser`: Subclass for users with local password authentication
  - Secure password hashing with bcrypt
  - Unique salt per user
  - Automatic password hashing on creation

- `ExternalUser`: Subclass for users authenticated through external services
  - No password storage
  - NULL password fields
  - Clean separation of concerns

## Database Constraints

1. **Email Uniqueness**
   - Ensures no duplicate email addresses
   - Applies across all user types

2. **Auth Method Validation**
   - Restricts `auth_method` to valid values
   - Enforces type safety at database level

3. **Password Field Consistency**
   - Ensures password fields are either both NULL or both have values
   - Maintains data integrity for external users

## Usage Example

```python
# Create a local user (password automatically hashed)
local_user = LocalUser(email="user@example.com", password="secret")

# Create an external user (no password required)
external_user = ExternalUser(email="oauth@example.com")

# Query all users (returns both types)
users = session.query(User).all()

# Query specific type
local_users = session.query(LocalUser).all()
```

## Security Features

1. **Password Storage**
   - Passwords are never stored in plain text
   - Each user has a unique salt
   - Uses bcrypt for secure hashing
   - Salt stored separately from hash

2. **Type Safety**
   - Literal types for auth methods
   - Database constraints for data integrity
   - Clear separation between user types

3. **Data Integrity**
   - Check constraints at database level
   - Consistent NULL handling
   - Proper field validation

## Educational Focus

This example is designed to teach:
- How to implement STI in SQLAlchemy
- The benefits of polymorphic inheritance in database design
- How to maintain clean code organization with multiple user types
- Security best practices for password storage
- Database constraint design
- Type safety in Python with SQLAlchemy

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

This example includes secure password handling for educational purposes. In a production environment, you would want to implement additional security measures such as:
- Rate limiting
- Password complexity requirements
- Account lockout policies
- Session management
- Additional authentication factors
- Secure secret management for `SECRET_KEY`
- Proper database configuration and access controls
- Regular security audits and updates
