FROM node:16-alpine3.11

WORKDIR /app
COPY . .

RUN npm install

ENTRYPOINT ["npm", "run", "start"]