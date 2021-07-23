FROM node:16-alpine3.11

ENV NODE_ENV=production

WORKDIR /app

# Install dependencies to speed up testing
COPY ["package*.json", "./"]
RUN npm install --production

COPY . .

RUN npm install

ENTRYPOINT ["npm", "run", "start"]
