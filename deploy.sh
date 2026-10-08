#!/bin/bash
set -e

# Configuration
REGISTRY="192.168.254.85:3000"
IMAGE_NAME="luis/next-tt"
CONTAINER_NAME="next-tt"
REGISTRY_USERNAME="${REGISTRY_USERNAME:-luis}"
REGISTRY_TOKEN="${REGISTRY_TOKEN}"

echo "========================================="
echo "Deploying Next.js Application"
echo "========================================="
echo "Container: $CONTAINER_NAME"
echo "Image: $REGISTRY/$IMAGE_NAME:latest"
echo ""

# Login to registry if credentials are provided
if [ ! -z "$REGISTRY_TOKEN" ] && [ ! -z "$REGISTRY_USERNAME" ]; then
  echo "Logging into container registry..."
  echo "$REGISTRY_TOKEN" | docker login $REGISTRY -u "$REGISTRY_USERNAME" --password-stdin
  echo "✓ Login successful"
  echo ""
fi

# Pull the latest image
echo "Pulling latest image..."
docker pull $REGISTRY/$IMAGE_NAME:latest
echo "✓ Image pulled successfully"
echo ""

# Stop and remove existing container if it exists
if docker ps -a | grep -q $CONTAINER_NAME; then
  echo "Stopping existing container..."
  docker stop $CONTAINER_NAME || true
  echo "✓ Container stopped"
  echo ""

  echo "Removing old container..."
  docker rm $CONTAINER_NAME || true
  echo "✓ Container removed"
  echo ""
fi

# Remove old images (keep only latest)
echo "Cleaning up old images..."
docker image prune -f
echo "✓ Old images cleaned up"
echo ""

# Start new container
echo "Starting new container..."
docker run -d \
  --name $CONTAINER_NAME \
  -p 3000:3000 \
  --restart unless-stopped \
  --env-file .env.production \
  $REGISTRY/$IMAGE_NAME:latest

echo "✓ Container started successfully"
echo ""

# Show container status
echo "Container status:"
docker ps | grep $CONTAINER_NAME
echo ""

# Show container logs (last 20 lines)
echo "Recent logs:"
docker logs --tail 20 $CONTAINER_NAME
echo ""

echo "========================================="
echo "Deployment completed successfully!"
echo "========================================="
