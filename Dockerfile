# Stage 1: Build Stage
FROM node:18-slim AS builder

WORKDIR /app
COPY package.json yarn.lock ./

RUN yarn install

COPY . .
RUN yarn run build

# Stage 2: Production Stage
FROM node:18-slim
WORKDIR /app

# Copy only the necessary files from the build stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/yarn.lock ./yarn.lock

# Install production dependencies only
RUN yarn install --production


EXPOSE 7988
CMD ["node", "dist/index.js"]
