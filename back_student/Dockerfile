FROM node:20-alpine

RUN addgroup -S service-web && adduser -S service-web -G service-web

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN test -s package.json \
    && node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"

RUN yarn install --frozen-lockfile \
    && yarn cache clean

# Monorepo static artifact injection
# Copy prebuilt distribution artifacts from host 'dist' into the container build folder
COPY dist ./build
COPY ormconfig.js ./
COPY start.js ./
COPY newrelic.js ./

RUN chown -R service-web:service-web /usr/src/app

ENV NODE_ENV=production

USER service-web

# Use the start wrapper which waits for DB port and then requires the built app
CMD ["node", "-r", "newrelic", "start.js"]
