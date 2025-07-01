import { Stagehand } from '@browserbasehq/stagehand';

async function testStagehandDOM() {
  console.log('🔍 Stagehand DOM View Test');
  console.log('='.repeat(50));

  const stagehand = new Stagehand({
    env: 'LOCAL',
    headless: false,
    verbose: 2,
    debugDom: true
  });

  try {
    await stagehand.init();
    console.log('\n🚀 Navigating to Google...');
    
    await stagehand.page.goto('https://www.google.com');
    await stagehand.page.waitForLoadState('networkidle');
    
    console.log('\n📸 Capturing DOM snapshot BEFORE search...\n');
    
    // Extract the DOM using Stagehand's internal method
    const domElements = await stagehand.page.extract({
      instruction: "Extract all visible elements on the page"
    });
    
    console.log('RAW DOM ELEMENTS FROM STAGEHAND:');
    console.log('='.repeat(70));
    
    // Print the raw output that the LLM would see
    if (domElements.outputString) {
      const lines = domElements.outputString.split('\n');
      console.log('First 50 lines of DOM representation:');
      console.log('-'.repeat(70));
      lines.slice(0, 50).forEach(line => console.log(line));
      console.log('-'.repeat(70));
      console.log(`Total elements: ${lines.length}`);
    }
    
    // Also print the selector map structure
    console.log('\nSELECTOR MAP SAMPLE:');
    if (domElements.selectorMap) {
      const keys = Object.keys(domElements.selectorMap).slice(0, 5);
      keys.forEach(key => {
        console.log(`${key}: ${JSON.stringify(domElements.selectorMap[key])}`);
      });
    }
    
    // Now search for "dog"
    console.log('\n🔍 Searching for "dog"...');
    await stagehand.act({ action: "type 'dog' in the search box" });
    await stagehand.act({ action: "press Enter to search" });
    
    await stagehand.page.waitForLoadState('networkidle');
    
    console.log('\n📸 Capturing DOM snapshot AFTER search...\n');
    
    const searchResults = await stagehand.page.extract({
      instruction: "Extract all visible elements on the search results page"
    });
    
    if (searchResults.outputString) {
      const lines = searchResults.outputString.split('\n');
      console.log('First 30 lines of search results DOM:');
      console.log('-'.repeat(70));
      lines.slice(0, 30).forEach(line => console.log(line));
      console.log('-'.repeat(70));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await stagehand.close();
  }
}

// Run the test
testStagehandDOM().catch(console.error);