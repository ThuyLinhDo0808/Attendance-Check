# Production image for the API. Includes Python + OpenCV so the blueprint
# analyzer (scripts/sam_analyzer.py) works on hosted platforms too.
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-opencv python3-numpy \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .

ENV NODE_ENV=production \
    PYTHON_BIN=python3 \
    PORT=4000
EXPOSE 4000
CMD ["node", "server.js"]
