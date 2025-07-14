all: dist/boreDOM.min.js dist/boreDOM.d.ts dist/boreDOM.js

# Install dependencies
node_modules:
	pnpm install

boreDOMCLI/node_modules:
	cd boreDOMCLI && pnpm install && cd ..

dist/boreDOM.min.js: node_modules 
	pnpm run build_module

dist/boreDOM.full.js: node_modules 
	pnpm run build_full_module

dist/boreDOM.d.ts: node_modules  
	pnpm run build_decls

dist/boreDOM.js: node_modules boreDOMCLI/boreDOM.js
	cp boreDOMCLI/boreDOM.js dist/

boreDOMCLI/generated_cli.js: node_modules dist/boreDOM.full.js
	pnpm run build_cli

boreDOMCLI/boreDOM.js: boreDOMCLI/node_modules  boreDOMCLI/generated_cli.js
	cd boreDOMCLI
	pnpm run build
	cd ..

tests/dist/boreDOM.min.js: dist/boreDOM.min.js
	cd tests && ln -fs ../dist .

# Run the development server
dev: node_modules
	pnpm run dev

# Run the development server
test: node_modules tests/dist/boreDOM.min.js
	find src/ | entr -s 'make clean && make all && pnpm run test'

clean:
	rm dist/*
	rm -rf node_modules 
	rm -rf boreDOMCLI/node_modules 

