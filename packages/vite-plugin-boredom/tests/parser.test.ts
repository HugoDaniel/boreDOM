import { describe, it, expect } from 'vitest';
import { parseComponentModule } from '../src/index';

describe('parseComponentModule', () => {
    it('should parse a valid component module', () => {
        const code = `
export const metadata = {
  name: 'ui-button',
  version: '1.0.0',
  dependencies: [],
  props: ['variant', 'label'],
  events: ['click']
};

export const style = \`
  @layer components.ui-button {
    ui-button button { color: blue; }
  }
\`;

export const template = \`
  <button data-dispatch="click" data-text="local.label"></button>
\`;

export const logic = ({ on, local }) => {
  local.label = 'Button';
  on('click', () => {});
};
`;

        const result = parseComponentModule(code);

        expect(result).not.toBeNull();
        expect(result?.metadata.name).toBe('ui-button');
        expect(result?.metadata.version).toBe('1.0.0');
        expect(result?.metadata.dependencies).toEqual([]);
        expect(result?.metadata.props).toEqual(['variant', 'label']);
        expect(result?.metadata.events).toEqual(['click']);
        expect(result?.style).toContain('@layer components.ui-button');
        expect(result?.template).toContain('data-dispatch="click"');
        expect(result?.logicSource).toContain('on(\'click\'');
    });

    it('should parse component with dependencies', () => {
        const code = `
export const metadata = {
  name: 'ui-counter',
  dependencies: ['ui-button', 'ui-icon']
};

export const style = \`ui-counter { display: block; }\`;
export const template = \`<div class="counter"></div>\`;
export const logic = ({ on }) => {};
`;

        const result = parseComponentModule(code);

        expect(result).not.toBeNull();
        expect(result?.metadata.name).toBe('ui-counter');
        expect(result?.metadata.dependencies).toEqual(['ui-button', 'ui-icon']);
    });

    it('should return null for invalid module (missing exports)', () => {
        const code = `
export const metadata = { name: 'test' };
export const style = \`\`;
// Missing template and logic
`;

        const result = parseComponentModule(code);

        expect(result).toBeNull();
    });

    it('should return null for invalid module (missing metadata.name)', () => {
        const code = `
export const metadata = { version: '1.0.0' };
export const style = \`\`;
export const template = \`\`;
export const logic = () => {};
`;

        const result = parseComponentModule(code);

        expect(result).toBeNull();
    });

    it('should handle complex template literals', () => {
        const code = `
export const metadata = { name: 'complex-component' };

export const style = \`
  .multi-line {
    display: flex;
    flex-direction: column;
  }
  .nested {
    padding: 10px;
  }
\`;

export const template = \`
  <div class="wrapper">
    <header>
      <h1 data-text="local.title"></h1>
    </header>
    <main>
      <slot></slot>
    </main>
  </div>
\`;

export const logic = ({ on, local, refs, onMount, onCleanup }) => {
  local.title = 'Hello';
  
  onMount(() => {
    console.log('Component mounted');
  });
  
  on('click', ({ e }) => {
    const { args } = e;
    console.log(args);
  });
  
  onCleanup(() => {
    // cleanup code
  });
};
`;

        const result = parseComponentModule(code);

        expect(result).not.toBeNull();
        expect(result?.metadata.name).toBe('complex-component');
        expect(result?.style).toContain('.multi-line');
        expect(result?.style).toContain('.nested');
        expect(result?.template).toContain('<header>');
        expect(result?.template).toContain('<slot></slot>');
        expect(result?.logicSource).toContain('onMount');
        expect(result?.logicSource).toContain('onCleanup');
    });

    it('should handle arrow function logic', () => {
        const code = `
export const metadata = { name: 'arrow-fn' };
export const style = \`\`;
export const template = \`<div></div>\`;
export const logic = ({ on }) => {
  on('test', ({ local }) => {
    local.value++;
  });
};
`;

        const result = parseComponentModule(code);

        expect(result).not.toBeNull();
        expect(result?.logicSource).toContain('=>');
    });

    it('should parse metadata with spreads and computed keys', () => {
        const code = `
const baseMetadata = {
  version: '1.2.3',
  props: ['variant']
};
const depsKey = 'dependencies';
const eventsKey = 'events';

export const metadata = {
  name: 'spread-component',
  ...baseMetadata,
  [depsKey]: ['ui-icon', 'ui-label'],
  [eventsKey]: ['ready'],
  props: [...baseMetadata.props, 'size']
};

const sharedStyle = \`
  spread-component { display: block; }
\`;
export const style = sharedStyle;

const sharedTemplate = \`<div data-text="local.label"></div>\`;
export const template = sharedTemplate;

const setup = ({ local }) => {
  local.label = 'ok';
};
export const logic = setup;
`;

        const result = parseComponentModule(code);

        expect(result).not.toBeNull();
        expect(result?.metadata.name).toBe('spread-component');
        expect(result?.metadata.version).toBe('1.2.3');
        expect(result?.metadata.dependencies).toEqual(['ui-icon', 'ui-label']);
        expect(result?.metadata.props).toEqual(['variant', 'size']);
        expect(result?.metadata.events).toEqual(['ready']);
        expect(result?.style).toContain('display: block');
        expect(result?.template).toContain('data-text');
        expect(result?.logicSource).toContain('local.label');
    });

    it('should parse components exported via named specifiers', () => {
        const code = `
const metadata = { name: 'spec-export' };
const style = \`spec-export { color: red; }\`;
const template = \`<span>ok</span>\`;
function logic({ local }) {
  local.ready = true;
}

export { metadata, style, template, logic };
`;

        const result = parseComponentModule(code);

        expect(result).not.toBeNull();
        expect(result?.metadata.name).toBe('spec-export');
        expect(result?.style).toContain('color: red');
        expect(result?.template).toContain('<span>ok</span>');
        expect(result?.logicSource).toContain('function logic');
    });
});

describe('component structure validation', () => {
    it('should extract all metadata fields', () => {
        const code = `
export const metadata = {
  name: 'full-component',
  version: '2.0.0',
  dependencies: ['dep-a', 'dep-b'],
  props: ['prop1', 'prop2', 'prop3'],
  events: ['event1', 'event2']
};

export const style = \`\`;
export const template = \`\`;
export const logic = () => {};
`;

        const result = parseComponentModule(code);

        expect(result?.metadata).toEqual({
            name: 'full-component',
            version: '2.0.0',
            dependencies: ['dep-a', 'dep-b'],
            props: ['prop1', 'prop2', 'prop3'],
            events: ['event1', 'event2']
        });
    });
});
