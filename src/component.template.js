export const metadata = {
  name: '__COMPONENT_NAME__',
  version: '1.0.0',
  dependencies: [],
  props: [],
  events: []
};

export const style = `
  @layer components.__COMPONENT_NAME__ {
    __COMPONENT_NAME__ {
      display: block;
    }
  }
`;

export const template = `
  <div>
    <p data-text="'Hello from __COMPONENT_NAME__!'"></p>
  </div>
`;

export const logic = ({ on, local, state }) => {
  // Component logic here
};
