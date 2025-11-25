FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only required dependencies
RUN npm install --production --no-optional @aws-sdk/client-dynamodb @aws-sdk/util-dynamodb

# Copy application files
COPY simple-server.js ./

# Set environment variables
ENV NODE_ENV=production

# Start the application
CMD ["node", "simple-server.js"]

