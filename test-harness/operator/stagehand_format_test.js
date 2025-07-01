/**
 * Stagehand Format Test - Extract what format Stagehand uses
 */

process.env.GOOGLE_API_KEY = "AIzaSyCHFtX09QsZnUVLYbv0E3EqVmfPiCImLTs";

import { Stagehand } from "../../stagehand/dist/index.js";
import { promises as fs } from 'fs';

async function main() {
    let stagehand;
    
    try {
        stagehand = new Stagehand({
            env: "LOCAL",
            headless: false,
            modelName: "gemini-2.0-flash",
        });
        
        await stagehand.init();
        await stagehand.page.goto('https://google.com', { waitUntil: 'networkidle' });
        
        // Use extract to ask about the format
        const formatInfo = await stagehand.page.extract({
            instruction: `Look at the elements on this page and tell me:
1. What format are elements presented in? (e.g., [number] type: text or something else)
2. Give me 5 specific examples of elements exactly as you see them
3. How are they numbered/indexed?`,
            schema: {
                type: "object",
                properties: {
                    format_description: { type: "string" },
                    example_elements: {
                        type: "array",
                        items: { type: "string" }
                    },
                    numbering_pattern: { type: "string" }
                }
            }
        });
        
        console.log("\nStagehand Format Info:");
        console.log(JSON.stringify(formatInfo, null, 2));
        
        // Save to file
        await fs.writeFile('stagehand_format_info.json', JSON.stringify(formatInfo, null, 2));
        console.log("\nSaved to stagehand_format_info.json");
        
    } catch (error) {
        console.error("Error:", error);
    } finally {
        if (stagehand) await stagehand.close();
    }
}

main();