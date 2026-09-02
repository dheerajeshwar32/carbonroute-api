# 1. Use a lightweight Node.js base image
FROM node:22-alpine AS builder

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# 4. Copy the rest of your source code
COPY . .

# 5. Compile TypeScript to pure JavaScript
RUN npm run build

# 6. Create the final, optimized production image
FROM node:22-alpine AS production
WORKDIR /app

# Copy only the compiled code and production dependencies from the builder
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm install --only=production

# 7. Expose the port your server listens on
EXPOSE 3000

# 8. Define the startup command
CMD ["node", "dist/server.js"]