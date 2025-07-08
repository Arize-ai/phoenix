"""Configuration management for Phoenix CLI."""

import json
import os
from pathlib import Path
from typing import Any, Dict, Optional, List

import keyring
from pydantic import BaseModel, Field
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64


class PhoenixInstance(BaseModel):
    """Represents a Phoenix instance configuration."""
    
    name: str = Field(..., description="Instance name")
    base_url: str = Field(..., description="Base URL of the Phoenix instance")
    api_key: Optional[str] = Field(None, description="API key for authentication")
    description: Optional[str] = Field(None, description="Instance description")
    default: bool = Field(False, description="Whether this is the default instance")


class PhoenixConfig(BaseModel):
    """Configuration for Phoenix CLI."""
    
    instances: Dict[str, PhoenixInstance] = Field(default_factory=dict)
    default_instance: Optional[str] = Field(None, description="Default instance name")


class ConfigManager:
    """Manages Phoenix CLI configuration and credentials."""
    
    def __init__(self, config_dir: Optional[Path] = None):
        """Initialize the configuration manager.
        
        Args:
            config_dir: Directory to store configuration files. Defaults to .phoenix in current directory.
        """
        self.config_dir = config_dir or Path.cwd() / ".phoenix"
        self.config_file = self.config_dir / "config.json"
        self.config_dir.mkdir(exist_ok=True)
        
        # Initialize encryption for sensitive data
        self._init_encryption()
        
    def _init_encryption(self) -> None:
        """Initialize encryption for sensitive data storage."""
        key_file = self.config_dir / ".key"
        
        if not key_file.exists():
            # Generate a new key
            key = Fernet.generate_key()
            with open(key_file, "wb") as f:
                f.write(key)
            # Make key file readable only by owner
            os.chmod(key_file, 0o600)
        else:
            with open(key_file, "rb") as f:
                key = f.read()
                
        self.cipher = Fernet(key)
    
    def _encrypt_data(self, data: str) -> str:
        """Encrypt sensitive data."""
        return self.cipher.encrypt(data.encode()).decode()
    
    def _decrypt_data(self, encrypted_data: str) -> str:
        """Decrypt sensitive data."""
        return self.cipher.decrypt(encrypted_data.encode()).decode()
    
    def load_config(self) -> PhoenixConfig:
        """Load configuration from file."""
        if not self.config_file.exists():
            return PhoenixConfig()
        
        try:
            with open(self.config_file, "r") as f:
                config_data = json.load(f)
            return PhoenixConfig(**config_data)
        except Exception as e:
            print(f"Error loading config: {e}")
            return PhoenixConfig()
    
    def save_config(self, config: PhoenixConfig) -> None:
        """Save configuration to file."""
        try:
            with open(self.config_file, "w") as f:
                json.dump(config.model_dump(), f, indent=2)
        except Exception as e:
            print(f"Error saving config: {e}")
    
    def add_instance(
        self, 
        name: str, 
        base_url: str, 
        api_key: Optional[str] = None,
        description: Optional[str] = None,
        set_default: bool = False
    ) -> None:
        """Add a new Phoenix instance.
        
        Args:
            name: Instance name
            base_url: Base URL of the Phoenix instance
            api_key: API key for authentication
            description: Instance description
            set_default: Whether to set this as the default instance
        """
        config = self.load_config()
        
        # Store API key securely using keyring
        if api_key:
            keyring.set_password("phoenix-cli", f"instance-{name}", api_key)
        
        instance = PhoenixInstance(
            name=name,
            base_url=base_url,
            api_key=None,  # Don't store in config file
            description=description,
            default=set_default
        )
        
        config.instances[name] = instance
        
        if set_default or not config.default_instance:
            config.default_instance = name
            # Update all instances to not be default
            for inst in config.instances.values():
                inst.default = False
            instance.default = True
        
        self.save_config(config)
        print(f"Added instance '{name}' successfully")
        if set_default:
            print(f"Set '{name}' as default instance")
    
    def remove_instance(self, name: str) -> None:
        """Remove a Phoenix instance.
        
        Args:
            name: Instance name to remove
        """
        config = self.load_config()
        
        if name not in config.instances:
            print(f"Instance '{name}' not found")
            return
        
        # Remove API key from keyring
        try:
            keyring.delete_password("phoenix-cli", f"instance-{name}")
        except keyring.errors.PasswordDeleteError:
            pass  # Key doesn't exist, that's fine
        
        del config.instances[name]
        
        # If this was the default instance, clear default
        if config.default_instance == name:
            config.default_instance = None
            if config.instances:
                # Set first available instance as default
                first_name = next(iter(config.instances.keys()))
                config.instances[first_name].default = True
                config.default_instance = first_name
        
        self.save_config(config)
        print(f"Removed instance '{name}' successfully")
    
    def list_instances(self) -> List[PhoenixInstance]:
        """List all configured instances."""
        config = self.load_config()
        return list(config.instances.values())
    
    def get_instance(self, name: Optional[str] = None) -> Optional[PhoenixInstance]:
        """Get instance configuration.
        
        Args:
            name: Instance name. If None, returns default instance.
            
        Returns:
            Instance configuration or None if not found
        """
        config = self.load_config()
        
        if name is None:
            name = config.default_instance
        
        if name is None or name not in config.instances:
            return None
        
        instance = config.instances[name]
        
        # Retrieve API key from keyring
        try:
            api_key = keyring.get_password("phoenix-cli", f"instance-{name}")
            if api_key:
                instance.api_key = api_key
        except Exception:
            pass  # API key not found, that's fine
        
        return instance
    
    def set_default_instance(self, name: str) -> None:
        """Set the default instance.
        
        Args:
            name: Instance name to set as default
        """
        config = self.load_config()
        
        if name not in config.instances:
            print(f"Instance '{name}' not found")
            return
        
        # Update all instances to not be default
        for inst in config.instances.values():
            inst.default = False
        
        config.instances[name].default = True
        config.default_instance = name
        
        self.save_config(config)
        print(f"Set '{name}' as default instance")