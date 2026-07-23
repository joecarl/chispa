import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['src/index.ts', 'src/html-compiler/vite-plugin.ts', 'src/html-compiler/cli.ts'],
	deps: {
		neverBundle: ['vite', 'postcss'],
	},
	fixedExtension: false,
});
