"""URL utilities for constructing clean, consistent URLs."""

from urllib.parse import urljoin, urlparse


class BaseURL:
    """
    A utility class for handling base URLs with consistent formatting.
    
    Ensures that base URLs are normalized (no trailing slash) and provides
    methods for constructing clean URLs by joining paths.
    """
    
    def __init__(self, base_url: str) -> None:
        """
        Initialize with a base URL, automatically normalizing it.
        
        Args:
            base_url: The base URL string to normalize
        """
        self._normalized_url = self._normalize_base_url(base_url)
    
    @staticmethod
    def _normalize_base_url(url: str) -> str:
        """
        Normalize a base URL by removing trailing slashes.
        
        Args:
            url: The URL string to normalize
            
        Returns:
            The normalized URL without trailing slashes
            
        Examples:
            >>> BaseURL._normalize_base_url("http://localhost:8000/")
            "http://localhost:8000"
            >>> BaseURL._normalize_base_url("https://api.example.com/v1/")
            "https://api.example.com/v1"
        """
        return str(url).rstrip('/')
    
    def join(self, *path_segments: str) -> str:
        """
        Join path segments to the base URL, ensuring proper URL formatting.
        
        Args:
            *path_segments: Path segments to join to the base URL
            
        Returns:
            A properly formatted URL with the path segments joined
            
        Examples:
            >>> base = BaseURL("http://localhost:8000")
            >>> base.join("datasets", "123", "experiments")
            "http://localhost:8000/datasets/123/experiments"
            >>> base.join("/datasets/", "/123/", "/experiments/")
            "http://localhost:8000/datasets/123/experiments"
        """
        if not path_segments:
            return self._normalized_url
        
        # Clean up path segments by removing leading/trailing slashes
        cleaned_segments = []
        for segment in path_segments:
            if segment:
                cleaned_segments.append(str(segment).strip('/'))
        
        if not cleaned_segments:
            return self._normalized_url
        
        # Join with forward slashes
        path = '/' + '/'.join(cleaned_segments)
        return self._normalized_url + path
    
    def __str__(self) -> str:
        """Return the normalized base URL as a string."""
        return self._normalized_url
    
    def __repr__(self) -> str:
        """Return a string representation of the BaseURL object."""
        return f"BaseURL('{self._normalized_url}')"