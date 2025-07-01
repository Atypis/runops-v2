#!/bin/bash

echo "🚀 Running POV Comparison Test"
echo "=============================="
echo ""

# Clean up previous results
rm -f browser_use_tree.txt stagehand_tree.txt

# Run Browser-Use test
echo "1️⃣  Running Browser-Use POV test..."
echo "-----------------------------------"
cd /Users/a1984/runops-v2/Johny\ Ive\ 3/test-harness/operator
python3 browser_use_pov.py

echo ""
echo ""

# Run Stagehand test
echo "2️⃣  Running Stagehand POV test..."
echo "--------------------------------"
node stagehand_pov.js

echo ""
echo ""
echo "✅ Both tests complete!"
echo ""
echo "📊 Results saved to:"
echo "   - browser_use_tree.txt"
echo "   - stagehand_tree.txt"
echo ""
echo "Use 'diff browser_use_tree.txt stagehand_tree.txt' to compare"