# SQLAlchemy Polymorphic Inheritance Vignette

This vignette demonstrates the concept of polymorphic inheritance in SQLAlchemy, specifically focusing on single table inheritance (STI) pattern. The example implements a user authentication system with two types of users: local users who authenticate with passwords and external users who authenticate through third-party services.

## What is Polymorphic Inheritance?

Polymorphic inheritance in SQLAlchemy allows you to create a hierarchy of classes that map to a single database table. A discriminator column (in our case, `auth_method`) determines which class should be instantiated for a given row.

## Key Concepts

1. **Base Class (`User`)**:
   - Abstract class that defines common attributes and behavior
   - Cannot be instantiated directly
   - Uses `__mapper_args__` to configure polymorphic behavior
   - Sets `polymorphic_identity=None` to indicate it's abstract

2. **Discriminator Column (`auth_method`)**:
   - Determines which subclass to instantiate
   - Has a check constraint to ensure valid values
   - Values correspond to subclass identities

3. **Subclasses**:
   - `LocalUser`: For users with local password authentication
   - `ExternalUser`: For users authenticated through external services
   - Each sets its own `polymorphic_identity` in `__mapper_args__`

## Implementation Details

The implementation demonstrates:

1. **Single Table Design**:
   - All users are stored in the same `users` table
   - Common fields (id, email) are defined in the base class
   - Subclass-specific fields (password_hash) are nullable

2. **Polymorphic Querying**:
   ```python
   # Query all users (returns both types)
   users = session.query(User).all()
   
   # Query specific user type
   local_users = session.query(LocalUser).all()
   ```

3. **Type Safety**:
   - Abstract base class prevents direct instantiation
   - Type hints ensure correct usage
   - Discriminator column has check constraint

## Example Usage

```python
# Create a local user
local_user = LocalUser(
    email="local@example.com",
    password="secure_password123"
)

# Create an external user
external_user = ExternalUser(
    email="external@example.com"
)

# Add to session
session.add(local_user)
session.add(external_user)
session.commit()

# Query all users
users = session.query(User).all()  # Returns both LocalUser and ExternalUser instances

# Query specific user types
local_users = session.query(LocalUser).all()  # Returns only LocalUser instances
```

## Benefits

1. **Code Organization**:
   - Clear separation of concerns between user types
   - Common functionality in base class
   - Type-specific behavior in subclasses

2. **Database Efficiency**:
   - Single table design reduces joins
   - No need for separate tables for each user type
   - Nullable columns for type-specific fields

3. **Flexibility**:
   - Easy to add new user types without schema changes
   - Consistent interface through base class
   - Type-safe querying

## Limitations

1. **Schema Constraints**:
   - All subclasses must share the same table structure
   - Additional columns for specific subclasses must be nullable
   - Complex queries may require careful consideration of the discriminator column

2. **Performance Considerations**:
   - Large number of nullable columns may impact performance
   - Queries may need to filter on discriminator column
   - Indexing strategy should consider discriminator values

## Running the Example

1. Install dependencies:
   ```bash
   pip install sqlalchemy
   ```

2. Run the example:
   ```bash
   python users.py
   ```

The script will:
- Create an in-memory SQLite database
- Create and persist different types of users
- Demonstrate querying capabilities
- Show error handling for abstract class instantiation
- Demonstrate password verification
