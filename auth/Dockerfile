# Using the base image of node - version 8.
FROM node:8

# Set the working directory.
WORKDIR /usr/src/app

# Add the package files to the container.
ADD package*.json ./

# Install the project dependencies.
RUN npm i

# Copy the rest of the project files.
COPY . .

# Expose the operating PORT.
EXPOSE 8201

# Start the auth microservice.
CMD node main.js