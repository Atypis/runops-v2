/**
 * Stagehand Simple POV Test
 * Just observe what elements Stagehand sees
 */

// Set the environment variable before importing
process.env.GOOGLE_API_KEY = "AIzaSyCHFtX09QsZnUVLYbv0E3EqVmfPiCImLTs";

import { Stagehand } from "../../stagehand/dist/index.js";
import { promises as fs } from 'fs';

async function getStagehandPov() {
    console.log("🔍 Stagehand Simple POV Test Starting...");
    console.log("=".repeat(80));
    
    let stagehand;
    
    try {
        // Initialize Stagehand with Gemini
        stagehand = new Stagehand({
            env: "LOCAL",
            headless: false,
            enableCaching: false,
            modelName: "gemini-2.0-flash",
            verbose: 2 // Enable verbose logging to see what's happening
        });
        
        // Initialize browser
        await stagehand.init();
        console.log("✅ Stagehand initialized");
        
        // Navigate to google.com
        await stagehand.page.goto('https://google.com', { waitUntil: 'networkidle' });
        console.log("✅ Navigated to google.com");
        
        // Use observe to see what elements are on the page
        console.log("🔍 Observing ALL page elements...");
        const allElements = await stagehand.page.observe();
        
        console.log("\n📊 Found", allElements.length, "observable elements");
        
        // Format output
        const output = `STAGEHAND SIMPLE POV TEST RESULTS
${"=".repeat(80)}

Total elements found: ${allElements.length}

ELEMENTS:
${JSON.stringify(allElements, null, 2)}
`;
        
        // Save to file
        await fs.writeFile('stagehand_tree.txt', output);
        
        console.log("\n✅ Stagehand POV captured successfully!");
        console.log("📄 Saved to: stagehand_tree.txt");
        console.log("\n" + "=".repeat(80));
        console.log("First 5 elements:");
        console.log("=".repeat(80));
        console.log(JSON.stringify(allElements.slice(0, 5), null, 2));
        
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