/**
 * How names from the HTML become names in the generated code: `data-cb="my-box"` is the
 * builder `myBox`, and a translated `aria-label` is guarded through `props['ariaLabel']`,
 * the DOM property a TypeScript binding would set. CSS custom properties (`--x`) are kept.
 */
export function camelize(str: string): string {
	if (str.startsWith('--')) {
		return str;
	}
	const arr = str.split('-');
	let camelized = '';
	arr.forEach((v, i) => {
		camelized += i === 0 ? v : v.charAt(0).toUpperCase() + v.slice(1);
	});
	return camelized;
}
