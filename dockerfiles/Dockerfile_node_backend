FROM node:15.14
WORKDIR /home/node/app

COPY ./app/package*.json ./
RUN npm install --only=production

COPY ./app .
CMD [ "npm", "start" ]