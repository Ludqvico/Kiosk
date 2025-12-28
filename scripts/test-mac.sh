#!/bin/bash

# Script di test per Mac
# Verifica che tutti i requisiti siano soddisfatti

echo "=== Test ambiente Mac ==="

# Verifica Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "✓ Node.js installato: $NODE_VERSION"
else
    echo "✗ Node.js NON installato"
    exit 1
fi

# Verifica npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo "✓ npm installato: $NPM_VERSION"
else
    echo "✗ npm NON installato"
    exit 1
fi

# Verifica Xcode Command Line Tools
if xcode-select -p &> /dev/null; then
    echo "✓ Xcode Command Line Tools installato"
else
    echo "✗ Xcode Command Line Tools NON installato"
    echo "  Installa con: xcode-select --install"
    exit 1
fi

# Verifica compilazione addon nativi
echo ""
echo "=== Test compilazione addon nativi ==="
npm run rebuild

if [ -f "build/Release/inputblocker.node" ]; then
    echo "✓ Addon nativo compilato correttamente"
else
    echo "✗ Errore nella compilazione dell'addon nativo"
    exit 1
fi

# Compila TypeScript
echo ""
echo "=== Test compilazione TypeScript ==="
npm run build

if [ -d "dist" ]; then
    echo "✓ TypeScript compilato correttamente"
else
    echo "✗ Errore nella compilazione TypeScript"
    exit 1
fi

echo ""
echo "=== Tutti i test superati! ==="
echo ""
echo "Puoi avviare l'app con: npm start"
echo ""
echo "IMPORTANTE: Ricorda di abilitare i permessi di Accessibilità in:"
echo "Preferenze di Sistema > Sicurezza e Privacy > Privacy > Accessibilità"
