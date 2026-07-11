#!/bin/bash
# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "========================================"
echo " Starting FitJourney App Deployment"
echo "========================================"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 node_modules not found, running npm install..."
    npm install
fi

echo "🚀 Building and deploying..."
npm run deploy

echo "========================================"
echo " Deployment completed!"
echo "========================================"
read -p "Press [Enter] key to exit..."
