import * as fs from 'fs';
import * as path from 'path';
import { HtmlCompiler } from './html-compiler';

const ALWAYS_SKIPPED_DIRS = ['node_modules', '.git', 'dist', '.chispa'];

/**
 * Whether `filePath` is covered by one of the `exclude` entries (paths relative to
 * `rootDir`, directories or files). A directory entry excludes everything below it.
 */
export function isExcluded(filePath: string, rootDir: string, exclude: string[]): boolean {
	const relative = path.relative(rootDir, filePath).split(path.sep).join('/');
	return exclude.some((entry) => {
		const normalized = entry.split(path.sep).join('/').replace(/\/+$/, '');
		return relative === normalized || relative.startsWith(normalized + '/');
	});
}

/** The result of compiling a template: its module code, its typings and where they belong. */
export class CompiledTemplate {
	constructor(
		readonly filePath: string,
		readonly ts: string,
		readonly dts: string
	) {}

	/** Writes the `.d.ts` to `.chispa/types`, mirroring the template path under the root. */
	writeTypes(rootDir: string) {
		const outDir = path.join(rootDir, '.chispa/types');
		const relativePath = path.relative(rootDir, this.filePath);
		const targetPath = path.join(outDir, relativePath + '.d.ts');
		const targetDir = path.dirname(targetPath);

		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}
		fs.writeFileSync(targetPath, this.dts);
	}
}

/** Compiles a template. Throws on a compile error. */
export async function compileTemplate(filePath: string, content: string): Promise<CompiledTemplate> {
	const { ts, dts } = await new HtmlCompiler(content).compile();
	return new CompiledTemplate(filePath, ts, dts);
}

/** Compiles a template and writes its types; a broken template is logged (the scan goes on). */
export async function generateTypes(filePath: string, content: string, rootDir: string) {
	try {
		const compiled = await compileTemplate(filePath, content);
		compiled.writeTypes(rootDir);
	} catch (e) {
		console.error(`[chispa] Error generating types for ${filePath}`, e);
	}
}

export async function findAndCompileHtmlFiles(dir: string, rootDir: string, exclude: string[] = []) {
	if (!fs.existsSync(dir)) return;
	const files = fs.readdirSync(dir);
	for (const file of files) {
		const fullPath = path.join(dir, file);
		if (fullPath === path.join(rootDir, 'index.html')) continue;
		if (isExcluded(fullPath, rootDir, exclude)) continue;
		if (fs.statSync(fullPath).isDirectory()) {
			if (!ALWAYS_SKIPPED_DIRS.includes(file)) {
				await findAndCompileHtmlFiles(fullPath, rootDir, exclude);
			}
		} else if (file.endsWith('.html')) {
			console.log('Generating types for', fullPath);
			const content = fs.readFileSync(fullPath, 'utf-8');
			await generateTypes(fullPath, content, rootDir);
		}
	}
}
