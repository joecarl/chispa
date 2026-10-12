import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { chispaHtmlPlugin, toVirtualId, fromVirtualId } from '../src/html-compiler/vite-plugin';
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

describe('Vite plugin: virtual module ids', () => {
	it('builds ids relative to the root, so no machine path can end up in dist', () => {
		const file = path.join(root, 'src', 'comp', 'comp.html');
		const id = toVirtualId(file, root);

		expect(id).toBe('\0src/comp/comp.html.chispa.ts');
		expect(id).not.toContain(root);
	});

	it('maps a virtual id back to the absolute file path', () => {
		const file = path.join(root, 'src', 'comp', 'comp.html');
		expect(fromVirtualId(toVirtualId(file, root), root)).toBe(file);
		expect(fromVirtualId('src/comp/comp.html.chispa.ts', root)).toBe(file);
	});

	it('resolves .html imports to a root-relative virtual id', async () => {
		const plugin = chispaHtmlPlugin();
		(plugin.configResolved as any)({ root });

		const file = path.join(root, 'src', 'comp', 'comp.html');
		const context = { resolve: vi.fn(async () => ({ id: file, external: false })) };
		const resolved = await (plugin.resolveId as any).call(context, './comp.html', path.join(root, 'src/comp/comp.ts'), {});

		expect(resolved).toBe('\0src/comp/comp.html.chispa.ts');
		// Our own ids are returned untouched when re-resolved
		expect(await (plugin.resolveId as any).call(context, resolved, undefined, {})).toBe(resolved);
	});

	it('loads a root-relative virtual id, compiling the template and emitting its types', async () => {
		const plugin = chispaHtmlPlugin();
		(plugin.configResolved as any)({ root });
		const file = write('src/comp/comp.html', TEMPLATE);

		const context = { addWatchFile: vi.fn() };
		const code = await (plugin.load as any).call(context, toVirtualId(file, root));

		expect(context.addWatchFile).toHaveBeenCalledWith(file);
		expect(code).toContain('box');
		expect(code).toContain('label');
		expect(code).not.toContain('import type');

		const dts = fs.readFileSync(generatedDts('src/comp/comp.html'), 'utf-8');
		expect(dts).toContain('export type CbBoxProps');
		expect(dts).toContain('export interface CbFragmentProps');
	});
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
