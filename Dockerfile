FROM node:16-alpine3.11

# Set node to production
ENV NODE_ENV=production

WORKDIR /app

# Install dependencies to speed up testing
COPY ["package*.json", "./"]
RUN npm install --production

COPY . .

ENTRYPOINT ["npm", "run", "start"]
