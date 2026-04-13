# Stage 1: Build the Vite frontend
FROM node:18-alpine AS frontend-build
WORKDIR /src/frontend
# Copy package files
COPY TradingEngine/frontend/package*.json ./
RUN npm ci

# Copy frontend source and build
COPY TradingEngine/frontend/ ./
RUN npm run build

# Stage 2: Build the .NET backend
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS backend-build
WORKDIR /src
# Copy project files and restore dependencies
COPY TradingEngine/TradingEngineServer/TradingEngineServer.csproj ./TradingEngine/TradingEngineServer/
RUN dotnet restore TradingEngine/TradingEngineServer/TradingEngineServer.csproj

# Copy the rest of the backend source code
COPY TradingEngine/TradingEngineServer/ ./TradingEngine/TradingEngineServer/

# Build and publish
RUN dotnet publish TradingEngine/TradingEngineServer/TradingEngineServer.csproj -c Release -o /app/publish

# Stage 3: Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app

# Copy the published backend
COPY --from=backend-build /app/publish .

# Copy the built frontend into wwwroot so the .NET app serves it
COPY --from=frontend-build /src/frontend/dist ./wwwroot

# Expose the API and WebSocket port
EXPOSE 12000

# Start the application
ENTRYPOINT ["dotnet", "TradingEngineServer.dll"]
