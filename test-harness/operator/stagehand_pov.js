/**
 * Stagehand POV Test
 * Captures the exact accessibility tree representation that Stagehand sends to the LLM
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
            modelApiKey: "AIzaSyCHFtX09QsZnUVLYbv0E3EqVmfPiCImLTs"
        });
        
        // Initialize browser
        await stagehand.init();
        console.log("✅ Stagehand initialized");
        
        // Navigate to google.com
        await stagehand.page.goto('https://google.com', { waitUntil: 'networkidle' });
        console.log("✅ Navigated to google.com");
        
        // Use act to get the verbatim accessibility tree
        const result = await stagehand.page.act({
            action: `Output the EXACT accessibility tree/DOM representation you see, including:
- All element indexes/numbers (like 0:, 1:, 2: or however they appear)
- Exact formatting as shown to you
- Every single element visible to you (all text nodes, buttons, links, etc.)
- The complete structure with any special formatting
- Any role information (like "button:", "link:", etc.)
- Do not summarize, interpret, or skip anything
- Output everything inside a code block
- Add '=== END OF TREE ===' when complete

Start with '=== STAGEHAND ACCESSIBILITY TREE ===' before the code block.`
        });
        
        // Save to file
        const output = `STAGEHAND POV TEST RESULTS
${"=".repeat(80)}
${result}`;
        
        await fs.writeFile('stagehand_tree.txt', output);
        
        console.log("\n✅ Stagehand POV captured successfully!");
        console.log("📄 Saved to: stagehand_tree.txt");
        console.log("\n" + "=".repeat(80));
        console.log("CAPTURED OUTPUT:");
        console.log("=".repeat(80));
        console.log(result);
        
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