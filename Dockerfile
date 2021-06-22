# Set node version
FROM node:16.2.0

# Set node to production
ENV NODE_ENV=production

# Use /app to store everything
WORKDIR /app

# Install dependencies to speed up testing
COPY ["package*.json", "./"]
RUN npm install --production

# Copy everything
COPY . .

# Run application
CMD [ "npm", "run", "start" ]
