import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { chispaHtmlPlugin } from '../src/html-compiler/vite-plugin';
import { findAndCompileHtmlFiles, isExcluded } from '../src/html-compiler/generator';

const TEMPLATE = `<div data-cb="box"><span data-cb="label">Hi</span></div>`;

let root: string;

function write(relativePath: string, content: string) {
	const fullPath = path.join(root, relativePath);
	fs.mkdirSync(path.dirname(fullPath), { recursive: true });
	fs.writeFileSync(fullPath, content);
	return fullPath;
}

function generatedDts(relativePath: string) {
	return path.join(root, '.chispa/types', relativePath + '.d.ts');
}

beforeEach(() => {
	root = fs.mkdtempSync(path.join(os.tmpdir(), 'chispa-plugin-'));
	vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	fs.rmSync(root, { recursive: true, force: true });
});

describe('Vite plugin: exclude option', () => {
	it('matches directories (and everything below) and single files, relative to the root', () => {
		const exclude = ['public', 'docs/legacy.html', 'nested/dir/'];
		expect(isExcluded(path.join(root, 'public/a.html'), root, exclude)).toBe(true);
		expect(isExcluded(path.join(root, 'public/deep/a.html'), root, exclude)).toBe(true);
		expect(isExcluded(path.join(root, 'docs/legacy.html'), root, exclude)).toBe(true);
		expect(isExcluded(path.join(root, 'nested/dir/x.html'), root, exclude)).toBe(true);

		expect(isExcluded(path.join(root, 'docs/other.html'), root, exclude)).toBe(false);
		expect(isExcluded(path.join(root, 'publicity/a.html'), root, exclude)).toBe(false);
		expect(isExcluded(path.join(root, 'src/public/a.html'), root, exclude)).toBe(false);
	});

	it('skips excluded paths when scanning the project for templates', async () => {
		write('src/comp/comp.html', TEMPLATE);
		write('public/page.html', TEMPLATE);
		write('docs/legacy.html', TEMPLATE);
		write('docs/kept.html', TEMPLATE);
		write('index.html', '<!DOCTYPE html><html><body></body></html>');

		await findAndCompileHtmlFiles(root, root, ['public', 'docs/legacy.html']);

		expect(fs.existsSync(generatedDts('src/comp/comp.html'))).toBe(true);
		expect(fs.existsSync(generatedDts('docs/kept.html'))).toBe(true);
		expect(fs.existsSync(generatedDts('public/page.html'))).toBe(false);
		expect(fs.existsSync(generatedDts('docs/legacy.html'))).toBe(false);
		expect(fs.existsSync(generatedDts('index.html'))).toBe(false);
	});

	it('passes the exclude option from the plugin to the scan on buildStart', async () => {
		write('src/comp/comp.html', TEMPLATE);
		write('public/page.html', TEMPLATE);

		const plugin = chispaHtmlPlugin({ exclude: ['public'] });
		(plugin.configResolved as any)({ root });
		await (plugin.buildStart as any).call({});

		expect(fs.existsSync(generatedDts('src/comp/comp.html'))).toBe(true);
		expect(fs.existsSync(generatedDts('public/page.html'))).toBe(false);
	});
});
