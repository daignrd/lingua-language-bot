FROM node:22-alpine

# Install ffmpeg for audio format conversion (Gemini TTS PCM -> OGG)
RUN apk add --no-cache ffmpeg

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the Live Tutor mini app static assets (frontend/dist)
RUN npm run build

# Start the bot
CMD ["npm", "start"]
