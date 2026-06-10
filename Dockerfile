# Stage 1: Build
FROM node:24-alpine AS build

WORKDIR /usr/src/app

# Copy dependency definition files
COPY package*.json ./

# Install all dependencies required for build
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production
FROM node:24-alpine AS production

# Set Node environment to production
ENV NODE_ENV=production

# Set working directory
WORKDIR /usr/src/app

# Change ownership of the app directory to the node user
RUN chown node:node /usr/src/app

# Switch to the non-root user for better security
USER node

# Copy dependency definition files with correct ownership
COPY --chown=node:node package*.json ./

# Install only production dependencies and clean cache
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled code from build stage with correct ownership
COPY --chown=node:node --from=build /usr/src/app/dist ./dist

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["node", "dist/main"]