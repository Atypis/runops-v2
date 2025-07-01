import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function captureStagehandDOM() {
  console.log('🔍 Capturing Stagehand DOM View');
  console.log('='.repeat(70));
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // Navigate to Google
    await page.goto('https://www.google.com');
    await page.waitForLoadState('networkidle');
    
    // Handle consent if needed
    try {
      await page.click('button:has-text("Alle akzeptieren")', { timeout: 3000 });
    } catch (e) {
      // Consent might not appear
    }
    
    // Search for "dog"
    await page.fill('textarea[name="q"]', 'dog');
    await page.press('textarea[name="q"]', 'Enter');
    await page.waitForLoadState('networkidle');
    
    // Load Stagehand's DOM extraction script
    const domScriptPath = path.join(__dirname, '../../../stagehand/dist/dom/process/processAllOfDom.js');
    const domScript = await fs.readFile(domScriptPath, 'utf-8');
    
    // Extract DOM using Stagehand's method
    const domData = await page.evaluate((script) => {
      // Create a temporary function to execute the script
      const func = new Function(script + '; return processDom();');
      return func();
    }, domScript);
    
    console.log('\nSTAGEHAND DOM VIEW:');
    console.log('-'.repeat(70));
    
    if (domData && domData.outputString) {
      const lines = domData.outputString.split('\n');
      // Print first 40 lines
      lines.slice(0, 40).forEach(line => console.log(line));
      console.log(`\n... (showing 40 of ${lines.length} total elements)`);
      
      // Save full output
      await fs.writeFile(
        path.join(__dirname, 'stagehand_dom.txt'),
        domData.outputString,
        'utf-8'
      );
      console.log('\n📄 Full Stagehand DOM saved to: stagehand_dom.txt');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

// Run the capture
captureStagehandDOM().catch(console.error);