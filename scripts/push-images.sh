#!/bin/bash
set -e

# Define registry user
REGISTRY_USER="ready2k"
BUILD_PRODUCTION=false

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --prod) BUILD_PRODUCTION=true ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

echo "🚀 Starting build process..."

# Define reusable build function
build_and_push() {
    SERVICE=$1
    DOCKERFILE=$2
    CONTEXT=$3
    TARGET=$4
    IMAGE_NAME="mystaycation-${SERVICE}"

    LABEL=""
    if [ "$BUILD_PRODUCTION" = true ]; then
        if [ ! -z "$TARGET" ]; then
             LABEL="(Production Target: ${TARGET})"
        else
             LABEL="(Production)"
        fi
    else
        if [ ! -z "$TARGET" ]; then
             LABEL="(Development Target: ${TARGET})"
        else
             LABEL="(Development)"
        fi
    fi

    echo "📦 Building ${SERVICE} ${LABEL}..."
    
    # Construct build command with EXPLICIT PLATFORM for Synology
    CMD="docker build"
    if [ "$SERVICE" == "web" ]; then
        CMD="${CMD} --no-cache"
    fi
    CMD="${CMD} --platform linux/amd64 -t ${IMAGE_NAME}:latest -f ${DOCKERFILE}"
    
    if [ "$BUILD_PRODUCTION" = true ] && [ ! -z "$TARGET" ]; then
        CMD="${CMD} --target ${TARGET}"
    elif [ "$BUILD_PRODUCTION" = false ] && [ ! -z "$TARGET" ]; then
        if [ "$TARGET" == "production" ]; then
             CMD="${CMD} --target development"
        else
             CMD="${CMD} --target ${TARGET}"
        fi
    fi
     
    CMD="${CMD} ${CONTEXT}"
    
    echo "   Running: ${CMD}"
    eval ${CMD}

    TARGET_TAG="${REGISTRY_USER}/${IMAGE_NAME}:latest"
    echo "🏷️  Tagging ${IMAGE_NAME}:latest as ${TARGET_TAG}..."
    docker tag "${IMAGE_NAME}:latest" "${TARGET_TAG}"

    echo "⬆️  Pushing ${TARGET_TAG}..."
    docker push "${TARGET_TAG}"
}

# START BUILDS

# 1. API 
if [ "$BUILD_PRODUCTION" = true ]; then
    build_and_push "api" "backend/Dockerfile" "./backend" "production"
else
    build_and_push "api" "backend/Dockerfile" "./backend" "development"
fi

# 2. Web
if [ "$BUILD_PRODUCTION" = true ]; then
    build_and_push "web" "web/Dockerfile" "./web" "production"
else
    build_and_push "web" "web/Dockerfile" "./web" "development"
fi

# 3. Monitoring (Single stage)
build_and_push "monitoring" "monitoring/Dockerfile" "./monitoring" ""

echo "✅ All builds and pushes completed!"
