# Use an official Python runtime as a parent image
FROM python:3.10


# Set the working directory in the container to /app
WORKDIR /app

# Add the current directory contents into the container at /app
ADD . /app

# Install any needed packages specified in requirements.txt
RUN pip install .

# Make port 6060 available to the world outside this container
EXPOSE 6060

# Run server.py when the container launches
CMD ["python", "src/phoenix/server/main.py", "--host", "0.0.0.0", "--port", "6060", "serve"]