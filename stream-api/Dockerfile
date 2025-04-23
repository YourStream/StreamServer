FROM node:22

# Встановлення ffmpeg
RUN apt-get update && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN npm install

CMD ["npm", "run", "start"]
