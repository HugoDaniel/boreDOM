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

test.describe('boredom validate (LLM fixtures)', () => {
  test('flags known issues in LLM outputs', async () => {
    const gemini = path.resolve(__dirname, '../tests/llm-fixtures/boredom-gemini-gemini.html');
    const minimax = path.resolve(__dirname, '../tests/llm-fixtures/boredom-minimax2.1-claude.html');
    const gpt5 = path.resolve(__dirname, '../tests/llm-fixtures/boredom-gpt5.2xhigh-codex.html');

    const geminiOut = await runValidate(gemini);
    expect(geminiOut).toContain('ERROR W005');
    expect(geminiOut).toContain('WARNING W006');
    expect(geminiOut).toContain('INFO W022');
    expect(geminiOut).toContain('WARNING W023');
    expect(geminiOut).toContain('ERROR W025');
    expect(geminiOut).toContain('WARNING J008');

    const minimaxOut = await runValidate(minimax);
    expect(minimaxOut).toContain('ERROR W001');
    expect(minimaxOut).toContain('WARNING W002');
    expect(minimaxOut).toContain('WARNING W004');
    expect(minimaxOut).toContain('INFO W022');

    const gpt5Out = await runValidate(gpt5);
    expect(gpt5Out).toContain('WARNING W021');
    expect(gpt5Out).toContain('INFO W022');
    expect(gpt5Out).toContain('ERROR W025');
    expect(gpt5Out).toContain('WARNING J005');
    expect(gpt5Out).toContain('WARNING J006');
    expect(gpt5Out).toContain('INFO J007');
    expect(gpt5Out).toContain('INFO J009');
  });
});
