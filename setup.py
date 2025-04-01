# setup.py
from setuptools import setup, find_packages

setup(
    name="phoenix-mcp-server",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "mcp>=1.5.0",
        "httpx>=0.24.0",
    ],
    entry_points={
        "console_scripts": [
            "phoenix-mcp=phoenix_mcp_server:main",
        ],
    },
    python_requires=">=3.8",
)