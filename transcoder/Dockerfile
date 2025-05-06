FROM node:22

# Встановлення ffmpeg
RUN apt-get update
RUN apt-get install -y ffmpeg
RUN apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN npm install

CMD ["npm", "run", "start"]
