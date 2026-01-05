#!/usr/bin/env node
import { findAndCompileHtmlFiles } from './generator';

const args = process.argv.slice(2);

if (args.includes('--compile-html')) {
	const rootDir = process.cwd();
	console.log('Scanning for HTML files...');
	await findAndCompileHtmlFiles(rootDir, rootDir);
	console.log('HTML compilation completed.');
} else {
	console.log('Usage: chispa-cli --compile-html');
}
