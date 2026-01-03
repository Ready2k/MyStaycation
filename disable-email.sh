#!/bin/bash

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ No .env file found!"
    exit 1
fi

# Check if EMAIL_ENABLED exists
if grep -q "EMAIL_ENABLED=" .env; then
    # Update existing value (using sed based on OS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' 's/EMAIL_ENABLED=.*/EMAIL_ENABLED=false/' .env
    else
        sed -i 's/EMAIL_ENABLED=.*/EMAIL_ENABLED=false/' .env
    fi
else
    # Append to file
    echo "" >> .env
    echo "# Email Control" >> .env
    echo "EMAIL_ENABLED=false" >> .env
fi

echo "✅ Email sending DISABLED in .env"
echo "♻️  Please restart containers to apply changes: docker-compose up -d"
