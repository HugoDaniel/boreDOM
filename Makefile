# Install dependencies
node_modules:
	pnpm install

dist/boreDOM.min.js:
	pnpm run build_module

dist/boreDOM.d.ts:
	pnpm run build_decls

build: node_modules dist/boreDOM.min.js dist/boreDOM.d.ts 

place: dist/boreDOM.min.js dist/boreDOM.d.ts
	cp dist/boreDOM.min.js ../fun/drawshader/static/js/external/boreDOM.js
	cp dist/boreDOM.d.ts ../fun/drawshader/static/js/external

# Run the development server
dev: node_modules
	pnpm run dev

# Run the development server
test: node_modules
	find src/ | entr -s 'make clean && make build && pnpm run test'

clean:
	rm dist/*

