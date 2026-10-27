FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev && npm cache clean --force
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY backend/sequelize.config.js ./backend/sequelize.config.js
COPY backend/.sequelizerc ./backend/.sequelizerc
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
WORKDIR /app/backend
EXPOSE 4000
CMD ["node", "dist/server.js"]