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

export async function generateTypes(filePath: string, content: string, rootDir: string) {
	try {
		const compiler = new HtmlCompiler(content);
		const { dts } = await compiler.compile();

		const outDir = path.join(rootDir, '.chispa/types');
		const relativePath = path.relative(rootDir, filePath);
		const targetPath = path.join(outDir, relativePath + '.d.ts');
		const targetDir = path.dirname(targetPath);

		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}
		fs.writeFileSync(targetPath, dts);
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
