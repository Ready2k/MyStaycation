#!/bin/bash
set -e

# Define registry user
REGISTRY_USER="ready2k"

# List of services to push
SERVICES=("api" "worker" "web" "monitoring")

echo "🚀 Preparing to push Docker images for user: ${REGISTRY_USER}"

for SERVICE in "${SERVICES[@]}"; do
    LOCAL_IMAGE="mystaycation-${SERVICE}:latest"
    TARGET_IMAGE="${REGISTRY_USER}/mystaycation-${SERVICE}:latest"

    # Check if local image exists
    if [[ "$(docker images -q ${LOCAL_IMAGE} 2> /dev/null)" == "" ]]; then
        echo "⚠️  Local image ${LOCAL_IMAGE} not found. Skipping."
        continue
    fi

    echo "🏷️  Tagging ${LOCAL_IMAGE} as ${TARGET_IMAGE}..."
    docker tag "${LOCAL_IMAGE}" "${TARGET_IMAGE}"

    echo "⬆️  Pushing ${TARGET_IMAGE}..."
    docker push "${TARGET_IMAGE}"
done

echo "✅ All available images pushed successfully!"
