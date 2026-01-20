#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const examplesDir = path.join(__dirname, '..', 'examples');
const examples = [
  'counter/index.html',
  'todo-list/index.html',
  'tic-tac-toe/index.html',
  'single-file/index.html'
];

console.log('🔍 Validating examples...\n');

let allPassed = true;

for (const example of examples) {
  const filePath = path.join(examplesDir, example);
  const fileName = path.basename(example);
  
  console.log(`📄 Checking ${fileName}...`);
  
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`❌ ${fileName}: File not found`);
      allPassed = false;
      continue;
    }
    
    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for required sections
    const requiredSections = ['STATE', 'TEMPLATES', 'LOGIC', 'RUNTIME'];
    let missingSections = [];
    
    for (const section of requiredSections) {
      if (!content.includes(`<!-- ${section} -->`)) {
        missingSections.push(section);
      }
    }
    
    if (missingSections.length > 0) {
      console.log(`❌ ${fileName}: Missing sections: ${missingSections.join(', ')}`);
      allPassed = false;
      continue;
    }
    
    // Check for micro-bindings in newer examples
    if (fileName !== 'tic-tac-toe/index.html') { // Tic Tac Toe uses a different pattern
      const hasMicroBindings = content.includes('data-text=') || content.includes('data-value=') || content.includes('data-show=');
      if (!hasMicroBindings) {
        console.log(`⚠️  ${fileName}: No micro-bindings found (consider adding for consistency)`);
      }
    }
    
    // Check for component-scoped styles
    const hasComponentStyles = content.includes('style data-component=');
    if (!hasComponentStyles) {
      console.log(`⚠️  ${fileName}: No component-scoped styles found (consider adding for consistency)`);
    }
    
    // Check for event handling consistency
    const hasDataDispatch = content.includes('data-dispatch=');
    const hasDirectRefs = content.includes('.onclick') || content.includes('.onclick=');
    
    if (hasDirectRefs && !hasDataDispatch) {
      console.log(`⚠️  ${fileName}: Uses direct refs but no data-dispatch (consider standardizing)`);
    }
    
    console.log(`✅ ${fileName}: All checks passed`);
    
  } catch (error) {
    console.log(`❌ ${fileName}: Error - ${error.message}`);
    allPassed = false;
  }
}

console.log('\n' + '='.repeat(50));
if (allPassed) {
  console.log('🎉 All examples validated successfully!');
} else {
  console.log('❌ Some examples need attention.');
  process.exit(1);
}