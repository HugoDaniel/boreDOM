import { test, expect } from '@playwright/test';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const runValidate = async (fixture: string) => {
  const bin = path.resolve(__dirname, '../bin/boredom.js');
  const { stdout } = await execFileAsync('node', [bin, 'validate', fixture], {
    cwd: path.resolve(__dirname, '..'),
  });
  return stdout;
};

test.describe('boredom validate', () => {
  test('prints warnings with suggestions', async () => {
    const fixture = path.resolve(__dirname, '../tests/validate-fixture.html');
    const output = await runValidate(fixture);

    expect(output).toContain('ERROR W001');
    expect(output).toContain('WARNING W002');
    expect(output).toContain('ERROR W003');
    expect(output).toContain('WARNING W004');
    expect(output).toContain('ERROR W005');
    expect(output).toContain('WARNING W006');
    expect(output).toContain('ERROR W007');
    expect(output).toContain('ERROR W008');
    expect(output).toContain('ERROR W009');
    expect(output).toContain('WARNING W010');
    expect(output).toContain('ERROR W011');
    expect(output).toContain('WARNING W012');
    expect(output).toContain('ERROR W013');
    expect(output).toContain('ERROR W014');
    expect(output).toContain('WARNING W015');
    expect(output).toContain('WARNING W016');
    expect(output).toContain('WARNING W017');
    expect(output).toContain('WARNING W018');
    expect(output).toContain('ERROR W019');
    expect(output).toContain('ERROR W020');
    expect(output).toContain('WARNING W021');
    expect(output).toContain('INFO W022');
    expect(output).toContain('WARNING W023');
    expect(output).toContain('INFO W024');
    expect(output).toContain('ERROR W025');
    expect(output).toContain('ERROR W026');
    expect(output).toContain('ERROR W027');
    expect(output).toContain('ERROR W028');
    expect(output).toContain('WARNING W029');
    expect(output).toContain('WARNING J001');
    expect(output).toContain('WARNING J002');
    expect(output).toContain('WARNING J003');
    expect(output).toContain('WARNING J004');
    expect(output).toContain('WARNING J005');
    expect(output).toContain('WARNING J006');
    expect(output).toContain('INFO J007');
    expect(output).toContain('WARNING J008');
    expect(output).toContain('INFO J009');

    expect(output).toContain('Suggestion: Rename to data-dispatch');
    expect(output).toContain('Suggestion: Format should be "className:expression"');
    expect(output).toContain('Suggestion: Add a <template data-item>');
    expect(output).toContain('Suggestion: Add data-dispatch-input');
    expect(output).toContain('Suggestion: Use bracket notation for numeric keys');
    expect(output).toContain('Suggestion: If your handler branches on keyup');
    expect(output).toContain('Suggestion: Use a single <template data-item>');
    expect(output).toContain('Suggestion: Use stable unique IDs for list keys');
    expect(output).toContain('Suggestion: Use one of: click, input, change');
    expect(output).toContain('Suggestion: Use unique data-ref values');
    expect(output).toContain('Suggestion: Check expression syntax');
    expect(output).toContain('Suggestion: Provide a valid expression for data-arg');
    expect(output).toContain('Suggestion: Keep a single <template data-component>');
    expect(output).toContain('Suggestion: Keep a single <script type="text/boredom" data-component>');
    expect(output).toContain('Suggestion: Add on("handleKey"');
    expect(output).toContain('Suggestion: Add data-dispatch="unusedHandler"');
    expect(output).toContain('Suggestion: Prefer refs or self.querySelector');
    expect(output).toContain('Suggestion: Prefer data-list/data-text bindings');
    expect(output).toContain('Suggestion: Add onCleanup to cancel timers');
    expect(output).toContain('Suggestion: Add data-dispatch-keyup');
    expect(output).toContain('Suggestion: Prefer pointerup or guard pointerout');
    expect(output).toContain('Suggestion: Prefer local/system fonts');
    expect(output).toContain('Suggestion: Time-based keys can collide');
    expect(output).toContain('Suggestion: Either set item.selected');
    expect(output).toContain('Suggestion: Use event.target or e.composedPath');
    expect(output).toContain('Suggestion: Scope keyboard handlers to the component');
    expect(output).toContain('Suggestion: Prefer data-attr-style or bindings');
    expect(output).toContain("Suggestion: Guard key handlers with event.target/composedPath()");
    expect(output).toContain('Suggestion: Consider state echoing for audio/canvas');
    expect(output).toContain('Suggestion: Use data-arg-* for event arguments');
    expect(output).toContain('Suggestion: Flatten the list or move the nested list');
    expect(output).toContain('Suggestion: Add <script src="./boreDOM.js" data-state="#initial-state"></script>.');
    expect(output).toContain('Suggestion: Replace with <script src="./boreDOM.js" data-state="#initial-state"></script>.');
    expect(output).toContain('Suggestion: Remove data-list-once/data-list-static when list items or state are expected to change.');
  });

  test('recognizes handler registrations through aliases', async () => {
    const fixture = path.resolve(__dirname, '../tests/validate-handlers.html');
    const output = await runValidate(fixture);

    expect(output.trim()).toBe('No issues found.');
  });
});
