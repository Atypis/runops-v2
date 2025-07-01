import { Stagehand } from '@browserbasehq/stagehand';

async function getStagehandDOM() {
  const stagehand = new Stagehand({
    env: 'LOCAL',
    headless: false,
    verbose: 0
  });

  try {
    await stagehand.init();
    await stagehand.page.goto('https://www.google.com');
    await stagehand.page.waitForLoadState('networkidle');
    
    // Get raw DOM using Stagehand's internal method
    const domSnapshot = await stagehand.page.evaluate(() => {
      if (typeof processDom === 'function') {
        return processDom();
      }
      // Fallback: manually call domExtract if processDom not available
      return { error: 'processDom not found, using fallback' };
    });

    // If the above didn't work, try using extract
    if (domSnapshot.error) {
      const extracted = await stagehand.page.extract({
        instruction: "Extract the entire visible page"
      });
      console.log('STAGEHAND RAW DOM OUTPUT:');
      console.log('='.repeat(80));
      console.log(extracted.outputString);
      console.log('='.repeat(80));
    } else {
      console.log('STAGEHAND RAW DOM OUTPUT:');
      console.log('='.repeat(80));
      console.log(domSnapshot.outputString);
      console.log('='.repeat(80));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await stagehand.close();
  }
}

getStagehandDOM();