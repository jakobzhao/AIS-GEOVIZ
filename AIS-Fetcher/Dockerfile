FROM node:8.2

# Create app directory
RUN mkdir -p /zzzEarth/AIS-Fetcher
WORKDIR /zzzEarth/AIS-Fetcher

# Install app dependencies
COPY package.json /zzzEarth/AIS-Fetcher
RUN npm install pm2 -g
RUN npm install

# Bundle app source
COPY .  /zzzEarth/AIS-Fetcher

# EXPOSE 5858
CMD ["pm2-docker", "index.js"]