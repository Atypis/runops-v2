/**
 * Stagehand POV Test - Fixed Version
 * Captures the accessibility tree as Stagehand sees it
 */

import { Stagehand } from "../../stagehand/dist/index.js";
import { promises as fs } from 'fs';

async function getStagehandPov() {
    console.log("🔍 Stagehand POV Test Starting...");
    console.log("=".repeat(80));
    
    let stagehand;
    
    try {
        // Initialize Stagehand with Gemini
        stagehand = new Stagehand({
            env: "LOCAL",
            headless: false, // Show browser for debugging
            enableCaching: false,
            modelName: "gemini-2.0-flash-exp",
            modelClientOptions: {
                apiKey: "AIzaSyCHFtX09QsZnUVLYbv0E3EqVmfPiCImLTs"
            }
        });
        
        // Initialize browser
        await stagehand.init();
        console.log("✅ Stagehand initialized");
        
        // Navigate to google.com
        await stagehand.page.goto('https://google.com', { waitUntil: 'networkidle' });
        console.log("✅ Navigated to google.com");
        
        // Use observe to see what elements are on the page
        console.log("🔍 Observing page elements...");
        const elements = await stagehand.page.observe({
            instruction: "Find ALL elements on the page - every button, link, input, text, image, and any other element you can see. Include their full details."
        });
        
        // Also try to extract the raw representation
        console.log("📊 Extracting accessibility tree representation...");
        const treeRepresentation = await stagehand.page.extract({
            instruction: `Please provide the EXACT accessibility tree or DOM representation that you see when looking at this page. 
Include:
- All element indexes/numbers exactly as they appear to you
- The exact format you see (whether it's numbered like 0:, 1:, 2: or uses some other structure)
- Every single element including text nodes
- The complete hierarchical structure if visible
- Any special formatting or notation

Output the entire representation inside a code block, starting with:
=== STAGEHAND ACCESSIBILITY TREE ===

And ending with:
=== END OF TREE ===`,
            schema: {
                type: "object",
                properties: {
                    accessibilityTree: {
                        type: "string",
                        description: "The complete accessibility tree representation"
                    }
                }
            }
        });
        
        // Format output
        const output = `STAGEHAND POV TEST RESULTS
${"=".repeat(80)}

ELEMENTS OBSERVED:
${JSON.stringify(elements, null, 2)}

ACCESSIBILITY TREE REPRESENTATION:
${treeRepresentation.accessibilityTree || "No tree representation extracted"}
`;
        
        // Save to file
        await fs.writeFile('stagehand_tree.txt', output);
        
        console.log("\n✅ Stagehand POV captured successfully!");
        console.log("📄 Saved to: stagehand_tree.txt");
        console.log("\n" + "=".repeat(80));
        console.log("CAPTURED OUTPUT:");
        console.log("=".repeat(80));
        console.log(output);
        
    } catch (error) {
        console.error("\n❌ Error:", error.message);
        console.error(error.stack);
    } finally {
        if (stagehand) {
            await stagehand.close();
        }
    }
}

// Run the test
getStagehandPov().catch(console.error);