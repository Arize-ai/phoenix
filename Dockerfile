# This dockerfile is provided for convenience if you wish to run
# Phoenix in a docker container / sidecar. 
# To use this dockerfile, you must first build the phoenix image
# using the following command:
# > docker build -t phoenix .
# You can then run that image with the following command:
# > docker run -d --name phoenix -p 6006:6006 phoenix
# If you have a production use-case for phoenix, please get in touch!

# Use an official Python runtime as a parent image
FROM python:3.10

# Install nodejs
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs

# Set the phoenix directory in the container to /phoenix
WORKDIR /phoenix

# Add the current directory contents into the container at /phoenix
ADD . /phoenix

# Install the app by building the typescript package
RUN cd /phoenix/app && npm install && npm run build

# Install any needed packages 
RUN pip install .

# Make port 6006 available to the world outside this container
EXPOSE 6006

# Run server.py when the container launches
CMD ["python", "src/phoenix/server/main.py", "--host", "0.0.0.0", "--port", "6006", "serve"]