FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY index.js ./

# Run as non-root user
USER node

# Start the controller
CMD ["node", "index.js"]

