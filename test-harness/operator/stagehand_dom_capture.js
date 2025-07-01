/**
 * Stagehand DOM Capture - Get what Stagehand actually shows to the LLM
 */

// Set the environment variable before importing
process.env.GOOGLE_API_KEY = "AIzaSyCHFtX09QsZnUVLYbv0E3EqVmfPiCImLTs";

import { Stagehand } from "../../stagehand/dist/index.js";
import { promises as fs } from 'fs';

async function getStagehandDOM() {
    console.log("🔍 Stagehand DOM Capture Starting...");
    console.log("=".repeat(80));
    
    let stagehand;
    
    try {
        // Initialize Stagehand with Gemini
        stagehand = new Stagehand({
            env: "LOCAL",
            headless: false,
            enableCaching: false,
            modelName: "gemini-2.0-flash",
            verbose: 2
        });
        
        // Initialize browser
        await stagehand.init();
        console.log("✅ Stagehand initialized");
        
        // Navigate to google.com
        await stagehand.page.goto('https://google.com', { waitUntil: 'networkidle' });
        console.log("✅ Navigated to google.com");
        
        // Use act to ask the model to output what it sees
        console.log("📝 Asking Stagehand to write DOM representation...");
        
        // First, let's try to get the DOM representation that Stagehand sends to the LLM
        await stagehand.page.act({
            action: `Please write the EXACT DOM or element representation you see to a file called 'stagehand_dom.txt'. 
Include:
- The exact format of how elements are presented to you
- All the numbers/indexes you see (like 0:, 1:, 2: or [0], [1], [2] or however they appear)
- The complete structure as you see it
- Don't summarize - include EVERYTHING exactly as shown to you
- Include any special formatting or notation

Start the file with:
=== STAGEHAND DOM REPRESENTATION ===

End with:
=== END OF DOM ===`
        });
        
        console.log("✅ Act command executed");
        
        // Also use extract to get more info
        console.log("📊 Extracting additional DOM info...");
        const domInfo = await stagehand.page.extract({
            instruction: `Describe the exact format of the DOM/element representation you see. What format are the elements in? How are they numbered? Give specific examples from what you're currently seeing.`,
            schema: {
                type: "object", 
                properties: {
                    format_description: {
                        type: "string",
                        description: "Description of the DOM format"
                    },
                    example_elements: {
                        type: "array",
                        items: {
                            type: "string"
                        },
                        description: "Examples of actual elements as they appear"
                    },
                    numbering_system: {
                        type: "string",
                        description: "How elements are numbered/indexed"
                    }
                }
            }
        });
        
        // Try to find and read the file
        let fileContent = "File not found";
        try {
            // Check current directory
            fileContent = await fs.readFile('stagehand_dom.txt', 'utf-8');
        } catch (e) {
            console.log("File not in current directory, checking other locations...");
            // Try Downloads folder
            try {
                const downloadsPath = `${process.env.HOME}/Downloads/stagehand_dom.txt`;
                fileContent = await fs.readFile(downloadsPath, 'utf-8');
                console.log("Found in Downloads folder");
            } catch (e2) {
                console.log("Could not find file");
            }
        }
        
        // Save results
        const output = `STAGEHAND DOM CAPTURE RESULTS
${"=".repeat(80)}

DOM FORMAT INFO:
${JSON.stringify(domInfo, null, 2)}

FILE CONTENT (if found):
${fileContent}

${"=".repeat(80)}
`;
        
        await fs.writeFile('stagehand_dom_results.txt', output);
        
        console.log("\n✅ Results saved to stagehand_dom_results.txt");
        console.log("\nDOM Format Info:");
        console.log(JSON.stringify(domInfo, null, 2));
        
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
getStagehandDOM().catch(console.error);