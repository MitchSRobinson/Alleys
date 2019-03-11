FROM node:8

WORKDIR /usr/src/app

ADD package*.json ./
RUN npm i

COPY . .

EXPOSE 8443
CMD node main.js