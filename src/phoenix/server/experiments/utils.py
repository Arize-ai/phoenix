def generate_experiment_project_name(prefix: str = "Experiment") -> str:
    """
    Generate a dynamic project name with a given prefix.
    This ensures each experiment gets its own project to avoid conflicts.
    
    Args:
        prefix: The prefix for the project name. Defaults to "Experiment".
        
    Returns:
        A unique project name in the format "{prefix}-{random_hex}".
    """
    from random import getrandbits
    return f"{prefix}-{getrandbits(96).to_bytes(12, 'big').hex()}"