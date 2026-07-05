#!/bin/bash
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
nvm use 20 > /dev/null
cd "$(dirname "$0")"
exec npm run dev
