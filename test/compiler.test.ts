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

	it('should compile demo-nested-component.html', async () => {
		const htmlPath = path.join(__dirname, 'example/src/demo-nested-component/demo-nested-component.html');
		const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

		const compiler = new HtmlCompiler(htmlContent);
		const { ts, dts } = await compiler.compile();

		expect(ts).toContain('const template = {');
		expect(ts).toContain('colorText:');
		expect(ts).toContain('box:');
		expect(dts).toContain('type CbBoxProps');
		expect(dts).toContain('interface CbFragmentProps');

		// Optional: write to file to inspect
		// fs.writeFileSync(htmlPath + '.generated.ts', ts);
		// fs.writeFileSync(htmlPath + '.generated.d.ts', dts);
	});

	it('should not leak the SVG context of an <svg data-cb> into the following elements', async () => {
		const htmlContent = `
			<svg data-cb="icon" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"></circle></svg>
			<div class="after"><span>after</span></div>
		`;
		const compiler = new HtmlCompiler(htmlContent);
		const { ts, dts } = await compiler.compile();

		// The svg item and its children are SVG elements
		expect(ts).toContain(`document.createElementNS('http://www.w3.org/2000/svg', 'svg')`);
		expect(ts).toContain(`document.createElementNS('http://www.w3.org/2000/svg', 'circle')`);
		expect(dts).toContain(`SVGElementTagNameMap['svg']`);

		// The elements after it are plain HTML
		expect(ts).toContain(`document.createElement('div')`);
		expect(ts).toContain(`document.createElement('span')`);
		expect(ts).not.toContain(`createElementNS('http://www.w3.org/2000/svg', 'DIV')`);
		expect(ts).not.toContain(`createElementNS('http://www.w3.org/2000/svg', 'SPAN')`);
	});

	it('should keep the SVG context for a data-cb item nested inside an <svg>', async () => {
		const htmlContent = `<svg viewBox="0 0 10 10"><g data-cb="shape"><rect width="1" height="1"></rect></g></svg><p>text</p>`;
		const compiler = new HtmlCompiler(htmlContent);
		const { ts, dts } = await compiler.compile();

		expect(ts).toContain(`document.createElementNS('http://www.w3.org/2000/svg', 'g')`);
		expect(ts).toContain(`document.createElementNS('http://www.w3.org/2000/svg', 'rect')`);
		expect(dts).toContain(`SVGElementTagNameMap['g']`);
		expect(ts).toContain(`document.createElement('p')`);
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
