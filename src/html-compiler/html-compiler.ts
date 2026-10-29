import { JSDOM } from 'jsdom';
import { format } from 'prettier';
import { collectI18nMarks, I18nCodegen, isContentText } from './html-compiler-i18n';
import { camelize } from './naming';

const VOID_ELEMENTS = ['area', 'base', 'br', 'hr', 'img', 'input', 'link', 'meta', 'param', 'keygen', 'source'];

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const MATHML_NAMESPACE = 'http://www.w3.org/1998/Math/MathML';

// A camelized data-cb becomes a property name and a type name in the generated code.
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

// Creating a JSDOM window costs more than parsing a template, so a single window is
// shared by every compilation; each template is parsed into its own fragment.
const sharedDocument = new JSDOM('').window.document;

export class HtmlCompiler {
	private components: Record<string, string> = {};
	private cbids = new Set<string>(); // camelized data-cb names seen so far, to reject duplicates
	private stack: string[] = ['fragment'];
	private componentsItems: Record<string, string[]> = {};
	private componentsTags: Record<string, string> = {};
	private componentsNamespaces: Record<string, string | null> = {};
	private i18n = new I18nCodegen();
	private root: DocumentFragment;

	constructor(htmlContent: string) {
		// Parse as <template> content: in body context the HTML parser silently drops
		// elements that only make sense inside a parent (a root <tr>, <td>, <tbody>...),
		// while the "in template" insertion mode keeps them, as a partial template needs.
		const template = sharedDocument.createElement('template');
		template.innerHTML = htmlContent;
		this.root = template.content;
	}

	// Kept for the future path prefixing of inline styles (the PHP compiler's
	// prefixizeStyle), see the `style` branch in getHtmlNodeAttrs.
	private static parseStyle(cssCode: string): string {
		let out = '{';
		const styles = cssCode.split(';');
		for (const line of styles) {
			const parts = line.split(':');
			if (parts.length !== 2) continue;
			const prop = camelize(parts[0].trim());
			out += ` ${prop}: '${parts[1].trim()}',`;
		}
		out += '}';
		return out;
	}

	private makeClassAttr(classAttr: string | null): string {
		const tplClasses = (classAttr || '').split(' ');
		let finalClass = '';

		for (const tplClass of tplClasses) {
			if (tplClass.startsWith('-tpl--')) continue;
			finalClass += tplClass + ' ';
		}

		finalClass = finalClass.trim();

		// No class attribute at all is better than an empty `class=""` on every node
		if (finalClass === '') return '';

		return ` 'class': "${finalClass}", `;
	}

	/** Static attributes of the node; `skip` holds the translated ones, set by `i18nAttr` instead. */
	private getHtmlNodeAttrs(domNode: Element, skip: ReadonlySet<string> = new Set()): string {
		let attrsHtml = '{';
		attrsHtml += this.makeClassAttr(domNode.getAttribute('class'));

		Array.from(domNode.attributes).forEach((attr) => {
			const attrName = attr.name;
			let attrValue = attr.value;

			if (attrName === 'data-cb') return;
			if (attrName === 'class') return;
			if (skip.has(attrName)) return;

			// Use JSON.stringify to properly escape newlines, quotes and other characters
			const valueLiteral = JSON.stringify(attrValue);

			if (attrName === 'style') {
				// TODO: PHP called cbt.prefixizeStyle, but also had parse_style static method.
				attrsHtml += ` '${attrName}': ${valueLiteral}, `;
			} else {
				attrsHtml += ` '${attrName}': ${valueLiteral}, `;
			}
		});

		attrsHtml += '}';
		return attrsHtml;
	}

	// Where an element is, for compile errors: `<p>`, `<button data-cb="btn">` or `<p> inside data-cb "card"`
	private describe(element: Element, isComponent: boolean): string {
		const owner = this.stack[0];
		if (owner === 'fragment') return `<${element.localName}>`;
		if (isComponent) return `<${element.localName} data-cb="${owner}">`;
		return `<${element.localName}> inside data-cb "${owner}"`;
	}

	private buildTsForNode(domNode: Node, isComponent = false): string {
		let htmlNodeCode = '';

		if (domNode.nodeType === 1) {
			// Element
			const element = domNode as Element;
			// Lower case for HTML elements; SVG and MathML keep their case (linearGradient...)
			const tagName = element.localName;
			// The parser tracks the namespace itself, including the way back to HTML
			// inside <foreignObject>, so there is no SVG context to keep here.
			const namespace = element.namespaceURI;

			let cbid = element.getAttribute('data-cb');

			if (cbid) {
				const currComp = this.stack[0];
				element.removeAttribute('data-cb');
				const rawCbid = cbid;
				cbid = camelize(cbid);
				// A repeated name would silently overwrite the previous builder (and render
				// the last element in every position), so fail at compile time instead.
				if (cbid === 'fragment') {
					throw new Error(`data-cb "${rawCbid}" is reserved: "fragment" is the builder of the whole template.`);
				}
				if (this.cbids.has(cbid)) {
					throw new Error(`Duplicate data-cb "${rawCbid}" (builder "${cbid}"): every data-cb in a template must be unique.`);
				}
				// An invalid name would only fail later, when the generated code is formatted,
				// with a syntax error pointing at generated lines.
				if (!IDENTIFIER.test(cbid)) {
					throw new Error(
						`data-cb "${rawCbid}" (builder "${cbid}") is not a valid identifier: use letters, digits, "_" and "-" (which camelizes), starting with a letter or "_".`
					);
				}
				this.cbids.add(cbid);
				// Pushear a todos los padres
				for (const comp of this.stack) {
					if (!this.componentsItems[comp]) {
						this.componentsItems[comp] = [];
					}
					this.componentsItems[comp].push(cbid);
				}

				this.stack.unshift(cbid);
				this.components[cbid] = this.buildTsForNode(element, true);
				this.componentsTags[cbid] = tagName;
				this.componentsNamespaces[cbid] = namespace;
				this.stack.shift();

				if (currComp === 'fragment') {
					htmlNodeCode += `getItem(template, props, '${cbid}')`;
				} else {
					htmlNodeCode += `getItem(template, props.nodes, '${cbid}')`;
				}
			} else {
				// Translation marks (`data-i18n*`) are read and removed before the attributes are emitted
				const marks = collectI18nMarks(element, this.describe(element, isComponent));
				const attrs = this.getHtmlNodeAttrs(element, new Set(marks.attrs.keys()));

				if (namespace === null || namespace === HTML_NAMESPACE) {
					htmlNodeCode += `(() => { const node = document.createElement('${tagName}');\n`;
				} else {
					htmlNodeCode += `(() => { const node = document.createElementNS('${namespace}', '${tagName}');\n`;
				}

				if (attrs !== '{}') {
					htmlNodeCode += `setAttributes(node, ${attrs});\n`;
				}
				if (isComponent) {
					htmlNodeCode += `setProps(node, props);\n`;
				}
				htmlNodeCode += this.i18n.attributes(element, marks.attrs, isComponent);

				let subTs = '';
				let textIndex = 0;
				element.childNodes.forEach((child) => {
					let chCode: string;
					if (isContentText(child)) {
						const mark = marks.texts.get(textIndex);
						chCode = mark ? this.i18n.textNode(child, mark.key) : this.buildTsForNode(child);
						textIndex++;
					} else {
						chCode = this.buildTsForNode(child);
					}
					if (chCode) {
						subTs += `appendChild(node, ${chCode});\n`;
					}
				});

				if (!VOID_ELEMENTS.includes(tagName)) {
					if (isComponent) {
						htmlNodeCode += `
                        if (props.inner === null) {
                            node.innerHTML = '';
                        } else if (props.inner !== undefined) {
                            node.innerHTML = '';
                            appendChild(node, props.inner);
                        } else {
                            ${subTs}
                        }
                        `;
					} else {
						htmlNodeCode += subTs;
					}
				}

				if (isComponent) {
					htmlNodeCode += `if (typeof props._ref === 'function') props._ref(node);\n`;
				}

				htmlNodeCode += `return node;})()`;
			}
		} else if (domNode.nodeType === 3) {
			// Text
			const textNode = domNode as Text;
			const parent = textNode.parentNode;
			// At the root the parent is the DocumentFragment, which is not an element
			const parentTag = parent && parent.nodeType === 1 ? (parent as Element).localName : '';

			const mustOmit = ['table', 'thead', 'tbody', 'tfoot', 'tr'].includes(parentTag);

			if (!mustOmit && textNode.textContent) {
				if (textNode.textContent.trim() === '') {
					if (textNode.textContent.length > 0) {
						htmlNodeCode += `document.createTextNode(' ')`;
					}
				} else {
					htmlNodeCode = `document.createTextNode(${JSON.stringify(textNode.textContent)})`;
				}
			}
		}

		return htmlNodeCode.trim();
	}

	private static getPropsTypename(cbid: string): string {
		return 'Cb' + cbid.charAt(0).toUpperCase() + cbid.slice(1) + 'Props';
	}

	private wrapFnComponent(cbid: string, jsx: string): string {
		const typename = HtmlCompiler.getPropsTypename(cbid);
		return `(props: ${typename}) => { \n return(${jsx}); \n }`;
	}

	private createAllComponents() {
		let rendererJsx = '(() => { const fragment = document.createDocumentFragment();\n';

		this.root.childNodes.forEach((child) => {
			const chCode = this.buildTsForNode(child);
			if (chCode) {
				rendererJsx += `appendChild(fragment, ${chCode});\n`;
			}
		});

		rendererJsx += 'return fragment;\n';
		rendererJsx += '})()';

		this.components['fragment'] = rendererJsx;
	}

	/**
	 * Element type of a data-cb item for the `.d.ts`: looked up in the tag name map of its
	 * namespace, with a fallback for the tags the map does not know (custom elements...).
	 */
	private static getElementType(tagname: string, namespace: string | null): string {
		if (namespace === SVG_NAMESPACE) return `TagElement<'${tagname}', SVGElementTagNameMap, SVGElement>`;
		if (namespace === MATHML_NAMESPACE) return `TagElement<'${tagname}', MathMLElementTagNameMap, MathMLElement>`;
		return `TagElement<'${tagname}', HTMLElementTagNameMap, HTMLElement>`;
	}

	private getTypedef(cbid: string): string {
		const items = this.componentsItems[cbid] || [];
		let itemsType = '{\n';
		items.forEach((itemCbid) => {
			const itemTypename = HtmlCompiler.getPropsTypename(itemCbid);
			itemsType += `${itemCbid}?: ${itemTypename} | ChispaContentReactive;\n`;
		});
		itemsType += '}\n';

		const typename = HtmlCompiler.getPropsTypename(cbid);

		if (cbid === 'fragment') {
			return `export interface ${typename} ${itemsType}`;
		} else {
			const elementType = HtmlCompiler.getElementType(this.componentsTags[cbid], this.componentsNamespaces[cbid]);
			return `export type ${typename} = ChispaNodeBuilderPropsReactive<${elementType}, ${itemsType}>;`;
		}
	}

	public async compile(): Promise<{ ts: string; dts: string }> {
		this.createAllComponents();

		let componentsClasses = '';
		let typedefs = '';

		for (const [cbid, compJsx] of Object.entries(this.components)) {
			typedefs += this.getTypedef(cbid) + '\n';
			componentsClasses += `${cbid}: ${this.wrapFnComponent(cbid, compJsx)},\n`;
		}

		// The translation helpers are imported only by the templates that use them
		const runtimeImports = ['appendChild', 'getItem', 'setAttributes', 'setProps', ...this.i18n.helpers].sort();

		const jsOutput = `
            import { ${runtimeImports.join(', ')} } from 'chispa';
            import type { ChispaContentReactive, ChispaNodeBuilderPropsReactive } from 'chispa';

            const template = {
                ${componentsClasses}
            };
            
            export default template;
        `;

		const dtsOutput = `
            import type { ChispaContentReactive, ChispaNodeBuilderPropsReactive } from 'chispa';

            type TagElement<Tag extends string, TagNameMap, Fallback> = Tag extends keyof TagNameMap ? TagNameMap[Tag] : Fallback;
            
            ${typedefs}
            
            declare const template: {
                ${Object.keys(this.components)
					.map((cbid) => {
						const typename = HtmlCompiler.getPropsTypename(cbid);
						return `${cbid}: (props: ${typename}) => Node | DocumentFragment;`;
					})
					.join('\n')}
            };
            
            export default template;
        `;

		const prettierOptions = {
			parser: 'typescript',
			semi: true,
			singleQuote: true,
			useTabs: true,
			printWidth: 120,
		};

		return {
			ts: await format(jsOutput, prettierOptions),
			dts: await format(dtsOutput, prettierOptions),
		};
	}
}
