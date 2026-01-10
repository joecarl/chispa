import { describe, it, expect } from 'vitest';
import { HtmlCompiler } from '../src/html-compiler/html-compiler';
import * as fs from 'fs';
import * as path from 'path';

describe('HTML Compiler', () => {
	it('should compile my-app-component.html', async () => {
		const htmlPath = path.join(__dirname, 'example/src/my-app-component/my-app-component.html');
		const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

		const compiler = new HtmlCompiler(htmlContent);
		const { ts, dts } = await compiler.compile();

		expect(ts).toContain('const template = {');
		expect(ts).toContain('links:');
		expect(ts).toContain('routerAnchor:');
		expect(dts).toContain('type CbLinksProps');
		expect(dts).toContain('interface CbFragmentProps');

		// Optional: write to file to inspect
		// fs.writeFileSync(htmlPath + '.generated.ts', ts);
		// fs.writeFileSync(htmlPath + '.generated.d.ts', dts);
	});

	it('preserves newline entities in attribute values (e.g. placeholder with &#10;)', async () => {
		const htmlContent = `<textarea placeholder="Linea1&#10;Linea2"></textarea>`;
		const compiler = new HtmlCompiler(htmlContent);
		const { ts } = await compiler.compile();

		// The compiled code should include the attribute value with an escaped newline (\n)
		expect(ts).toContain('placeholder');
		expect(ts).toContain('\\n');
	});
});
