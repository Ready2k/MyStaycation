#!/bin/bash

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ No .env file found!"
    exit 1
fi

# Check if EMAIL_ENABLED exists
if grep -q "EMAIL_ENABLED=" .env; then
    # Update existing value
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' 's/EMAIL_ENABLED=.*/EMAIL_ENABLED=true/' .env
    else
        sed -i 's/EMAIL_ENABLED=.*/EMAIL_ENABLED=true/' .env
    fi
else
    # Append to file
    echo "" >> .env
    echo "# Email Control" >> .env
    echo "EMAIL_ENABLED=true" >> .env
fi

echo "✅ Email sending ENABLED in .env"
echo "♻️  Please restart containers to apply changes: docker-compose up -d"
