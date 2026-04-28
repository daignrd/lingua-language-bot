FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application code
# This explicitly includes mcp.json, soul.md, and all src files
COPY . .

# Start the bot
CMD ["npm", "start"]
