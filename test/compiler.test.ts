import { describe, it, expect } from 'vitest';
import { HtmlCompiler } from '../src/html-compiler/html-compiler';
import * as fs from 'fs';
import * as path from 'path';

describe('HTML Compiler', () => {
	it('should compile my-component.html', () => {
		const htmlPath = path.join(__dirname, 'example/src/my-component/my-component.html');
		const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

		const compiler = new HtmlCompiler(htmlContent);
		const { js, dts } = compiler.compile();

		expect(js).toContain('const Components = {');
		expect(js).toContain('eldiv:');
		expect(dts).toContain('type TEldivProps');
		expect(dts).toContain('interface TFragmentProps');

		// Optional: write to file to inspect
		// fs.writeFileSync(htmlPath + '.generated.js', js);
		// fs.writeFileSync(htmlPath + '.generated.d.ts', dts);
	});
});
