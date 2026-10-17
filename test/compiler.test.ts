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

	it('should export the template prop types, so declaration emit of modules exposing the template can name them', async () => {
		const htmlContent = `<div data-cb="box"><span data-cb="label">Hi</span></div>`;
		const compiler = new HtmlCompiler(htmlContent);
		const { dts } = await compiler.compile();

		expect(dts).toContain('export type CbBoxProps');
		expect(dts).toContain('export type CbLabelProps');
		expect(dts).toContain('export interface CbFragmentProps');
		expect(dts).toContain('export default template');
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
		expect(dts).toContain(`TagElement<'svg', SVGElementTagNameMap, SVGElement>`);

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
		expect(dts).toContain(`TagElement<'g', SVGElementTagNameMap, SVGElement>`);
		expect(ts).toContain(`document.createElement('p')`);
	});

	it('should reject a duplicated data-cb instead of silently keeping the last one', async () => {
		const compiler = new HtmlCompiler(`<div data-cb="box">first</div><span data-cb="box">second</span>`);
		await expect(compiler.compile()).rejects.toThrow('Duplicate data-cb "box"');
	});

	it('should reject a duplicated data-cb nested inside the first occurrence', async () => {
		const compiler = new HtmlCompiler(`<div data-cb="box"><span data-cb="box">inner</span></div>`);
		await expect(compiler.compile()).rejects.toThrow('Duplicate data-cb "box"');
	});

	it('should reject two data-cb that camelize to the same builder name', async () => {
		const compiler = new HtmlCompiler(`<div data-cb="my-box"></div><div data-cb="myBox"></div>`);
		await expect(compiler.compile()).rejects.toThrow('Duplicate data-cb "myBox" (builder "myBox")');
	});

	it('should reject data-cb="fragment", which is reserved for the whole-template builder', async () => {
		const compiler = new HtmlCompiler(`<div data-cb="fragment"></div>`);
		await expect(compiler.compile()).rejects.toThrow('reserved');
	});

	it('should keep table elements at the root of a template (e.g. a <tr data-cb> row template)', async () => {
		const compiler = new HtmlCompiler(`<tr data-cb="row"><td data-cb="cell">x</td><td>static</td></tr>`);
		const { ts, dts } = await compiler.compile();

		expect(ts).toContain('row:');
		expect(ts).toContain('cell:');
		expect(ts).toContain(`document.createElement('tr')`);
		expect(ts).toContain(`document.createElement('td')`);
		expect(dts).toContain(`TagElement<'tr', HTMLElementTagNameMap, HTMLElement>`);
		expect(dts).toContain(`TagElement<'td', HTMLElementTagNameMap, HTMLElement>`);
		expect(dts).toMatch(/interface CbFragmentProps \{\s*row\?:/);
	});

	it('should type a custom element data-cb with a fallback, as it is not in HTMLElementTagNameMap', async () => {
		const compiler = new HtmlCompiler(`<my-widget data-cb="widget"></my-widget>`);
		const { ts, dts } = await compiler.compile();

		expect(ts).toContain(`document.createElement('my-widget')`);
		expect(dts).toContain(`type TagElement<Tag extends string, TagNameMap, Fallback> = Tag extends keyof TagNameMap ? TagNameMap[Tag] : Fallback;`);
		expect(dts).toContain(`TagElement<'my-widget', HTMLElementTagNameMap, HTMLElement>`);
	});

	it('should create the HTML content of an SVG <foreignObject> as HTML elements, not SVG ones', async () => {
		const compiler = new HtmlCompiler(`<svg data-cb="icon"><foreignObject><p data-cb="label">x</p></foreignObject></svg><div data-cb="after"></div>`);
		const { ts, dts } = await compiler.compile();

		expect(ts).toContain(`document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject')`);
		expect(ts).toContain(`document.createElement('p')`);
		expect(ts).toContain(`document.createElement('div')`);
		expect(ts).not.toContain(`'P'`);
		expect(dts).toContain(`TagElement<'p', HTMLElementTagNameMap, HTMLElement>`);
		expect(dts).toContain(`TagElement<'div', HTMLElementTagNameMap, HTMLElement>`);
	});

	it('should create MathML elements in their namespace', async () => {
		const compiler = new HtmlCompiler(`<math data-cb="formula"><mi>x</mi></math>`);
		const { ts, dts } = await compiler.compile();

		expect(ts).toContain(`document.createElementNS('http://www.w3.org/1998/Math/MathML', 'mi')`);
		expect(dts).toContain(`TagElement<'math', MathMLElementTagNameMap, MathMLElement>`);
	});

	it('should reject a data-cb that does not camelize to a valid identifier, with a clear error', async () => {
		for (const name of ['1st', 'my.box', 'a b', '--x']) {
			const compiler = new HtmlCompiler(`<div data-cb="${name}"></div>`);
			await expect(compiler.compile()).rejects.toThrow(`data-cb "${name}" (builder "${name}") is not a valid identifier`);
		}
	});

	it('should accept data-cb names with digits, "_" and "$" after the first character', async () => {
		const compiler = new HtmlCompiler(`<div data-cb="item-2"></div><div data-cb="_x"></div><div data-cb="a$"></div>`);
		const { ts } = await compiler.compile();
		expect(ts).toContain('item2:');
		expect(ts).toContain('_x:');
		expect(ts).toContain('a$:');
	});

	it('should not emit an empty class attribute, nor a setAttributes call for an element without attributes', async () => {
		const compiler = new HtmlCompiler(`<div><span class="-tpl--hidden">x</span><b class="bold" id="b">y</b></div>`);
		const { ts } = await compiler.compile();

		expect(ts).not.toContain(`class: ''`);
		expect(ts).not.toContain(`setAttributes(node, {})`);
		expect(ts).toContain(`setAttributes(node, { class: 'bold', id: 'b' })`);
		expect(ts).toMatch(/document\.createElement\('div'\);\s*appendChild/);
	});

	it('should parse every template in its own fragment, even though the JSDOM window is shared', async () => {
		const a = new HtmlCompiler(`<div data-cb="one"></div>`);
		const b = new HtmlCompiler(`<div data-cb="two"></div>`);
		const [ra, rb] = await Promise.all([a.compile(), b.compile()]);

		expect(ra.ts).toContain('one:');
		expect(ra.ts).not.toContain('two:');
		expect(rb.ts).toContain('two:');
		expect(rb.ts).not.toContain('one:');
	});

	it('should still compile text and elements at the root as before', async () => {
		const compiler = new HtmlCompiler(`hello <b data-cb="bold">world</b> !`);
		const { ts } = await compiler.compile();

		expect(ts).toContain(`document.createTextNode('hello ')`);
		expect(ts).toContain(`document.createTextNode(' !')`);
		expect(ts).toContain('bold:');
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
