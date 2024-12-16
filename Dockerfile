FROM node:22.12.0

EXPOSE 3000
EXPOSE 1935
EXPOSE 8000

WORKDIR /app

RUN apt-get update
RUN apt-get install -y ffmpeg

COPY . .
RUN npm install
RUN npm run build
CMD ["npm", "start"]