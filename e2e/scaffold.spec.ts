import { test, expect } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { spawn } from 'child_process';

const runCli = (
  args: string[],
  input?: string,
  cwd = path.resolve(__dirname, '..'),
) => {
  const bin = path.resolve(__dirname, '../bin/boredom.js');
  return new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
    const child = spawn('node', [bin, ...args], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, stderr, code }));

    if (input) {
      const lines = input
        .split('\n')
        .filter((line, index, all) => !(index === all.length - 1 && line === ''));
      lines.forEach((line, index) => {
        setTimeout(() => {
          if (child.stdin.destroyed) return;
          child.stdin.write(`${line}\n`);
        }, index * 20);
      });
    } else {
      child.stdin.end();
    }
  });
};

test.describe('boredom scaffold', () => {
  test('single-file scaffold matches src/scaffold.html when runtime is external', async () => {
    const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'boredom-scaffold-template-'));
    const target = path.join(tmpBase, 'project');

    const initResult = await runCli(['init', target, '--no-inline', '--no-vite']);
    expect(initResult.code).toBe(0);

    const indexPath = path.join(target, 'index.html');
    const generated = await fs.readFile(indexPath, 'utf8');
    const sourceTemplate = await fs.readFile(path.resolve(__dirname, '../src/scaffold.html'), 'utf8');

    expect(generated).toBe(sourceTemplate);
    await fs.access(path.join(target, 'boreDOM.js'));
  });

  test('single-file scaffold inlines runtime into the source template', async () => {
    const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'boredom-scaffold-inline-'));
    const target = path.join(tmpBase, 'project');

    const initResult = await runCli(['init', target, '--inline', '--no-vite']);
    expect(initResult.code).toBe(0);

    const runtimeMarker = `  <script src="./boreDOM.js" data-state="#initial-state"></script>`;
    const sourceTemplate = await fs.readFile(path.resolve(__dirname, '../src/scaffold.html'), 'utf8');
    const runtimeContent = (await fs.readFile(path.resolve(__dirname, '../src/boreDOM.js'), 'utf8')).trimEnd();
    const expectedInline = sourceTemplate.replace(
      runtimeMarker,
      ['  <script data-state="#initial-state">', runtimeContent, '  </script>'].join('\n'),
    );

    const indexPath = path.join(target, 'index.html');
    const generated = await fs.readFile(indexPath, 'utf8');

    expect(generated).toBe(expectedInline);
    await expect(fs.access(path.join(target, 'boreDOM.js'))).rejects.toThrow();
  });

  test('component command renders from src/component.template.js', async () => {
    const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'boredom-component-template-'));
    await fs.mkdir(path.join(tmpBase, 'components', 'ui'), { recursive: true });

    const result = await runCli(['component', 'my-widget'], undefined, tmpBase);
    expect(result.code).toBe(0);

    const generatedPath = path.join(tmpBase, 'components', 'ui', 'MyWidget.js');
    const generated = await fs.readFile(generatedPath, 'utf8');
    const componentTemplate = await fs.readFile(
      path.resolve(__dirname, '../src/component.template.js'),
      'utf8',
    );

    expect(generated).toBe(componentTemplate.split('__COMPONENT_NAME__').join('my-widget'));
  });

  test('default scaffold validates cleanly', async () => {
    const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'boredom-scaffold-'));
    const target = path.join(tmpBase, 'project');

    const initResult = await runCli(['init', target, '--no-inline', '--no-vite']);
    expect(initResult.code).toBe(0);

    const indexPath = path.join(target, 'index.html');
    const { stdout, code } = await runCli(['validate', indexPath]);

    expect(code).toBe(0);
    expect(stdout).toContain('No issues found.');
  });
});
