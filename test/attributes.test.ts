/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { HtmlCompiler } from '../src/html-compiler/html-compiler';
import { setAttributes } from '../src/builder';

describe('Attribute Handling', () => {
	describe('Compiler', () => {
		it('should include boolean attributes with empty string in compiled code', async () => {
			const htmlContent = `<input disabled checked required readonly>`;
			const compiler = new HtmlCompiler(htmlContent);
			const { ts } = await compiler.compile();

			expect(ts).toMatch(/disabled:\s*['"]['"]/);
			expect(ts).toMatch(/checked:\s*['"]['"]/);
			expect(ts).toMatch(/required:\s*['"]['"]/);
			expect(ts).toMatch(/readonly:\s*['"]['"]/);
		});

		it('should preserve attributes with values', async () => {
			const htmlContent = `<input type="text" value="hello" placeholder="world">`;
			const compiler = new HtmlCompiler(htmlContent);
			const { ts } = await compiler.compile();

			expect(ts).toMatch(/type:\s*['"]text['"]/);
			expect(ts).toMatch(/value:\s*['"]hello['"]/);
			expect(ts).toMatch(/placeholder:\s*['"]world['"]/);
		});
	});

	describe('setAttributes runtime', () => {
		it('should set attributes with empty string (boolean attributes)', () => {
			const input = document.createElement('input');
			setAttributes(input, { disabled: '' });
			expect(input.hasAttribute('disabled')).toBe(true);
			expect(input.getAttribute('disabled')).toBe('');
		});

		it('should set attributes with values', () => {
			const input = document.createElement('input');
			setAttributes(input, { type: 'text', value: 'test' });
			expect(input.getAttribute('type')).toBe('text');
			expect(input.getAttribute('value')).toBe('test');
		});

		it('should remove attributes if value is null', () => {
			const input = document.createElement('input');
			input.setAttribute('disabled', '');
			expect(input.hasAttribute('disabled')).toBe(true);

			setAttributes(input, { disabled: null as any });
			expect(input.hasAttribute('disabled')).toBe(false);
		});

		it('should remove attributes if value is undefined', () => {
			const input = document.createElement('input');
			input.setAttribute('title', 'some title');
			expect(input.getAttribute('title')).toBe('some title');

			setAttributes(input, { title: undefined as any });
			expect(input.hasAttribute('title')).toBe(false);
		});

		it('should not remove attributes if value is empty string', () => {
			const input = document.createElement('input');
			setAttributes(input, { class: '' });
			expect(input.hasAttribute('class')).toBe(true);
		});
	});
});
