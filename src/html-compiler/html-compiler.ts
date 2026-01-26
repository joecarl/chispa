import { JSDOM } from 'jsdom';
import { format } from 'prettier';

const VOID_ELEMENTS = ['area', 'base', 'br', 'hr', 'img', 'input', 'link', 'meta', 'param', 'keygen', 'source'];

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

export class HtmlCompiler {
	private components: Record<string, string> = {};
	private stack: string[] = ['fragment'];
	private componentsItems: Record<string, string[]> = {};
	private componentsTags: Record<string, string> = {};
	private isSvg: Record<string, boolean> = {};
	private inSvgContext = 0;
	private htmlDocument: Document;

	constructor(htmlContent: string) {
		const dom = new JSDOM(htmlContent);
		this.htmlDocument = dom.window.document;
	}

	private static camelize(str: string): string {
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

	private static parseStyle(cssCode: string): string {
		let out = '{';
		const styles = cssCode.split(';');
		styles.forEach((line) => {
			const parts = line.split(':');
			if (parts.length !== 2) return;
			const prop = HtmlCompiler.camelize(parts[0].trim());
			out += ` ${prop}: '${parts[1].trim()}',`;
		});
		out += '}';
		return out;
	}

	private makeClassAttr(classAttr: string | null, isComponent: boolean): string {
		const tplClasses = (classAttr || '').split(' ');
		let finalClass = '';

		tplClasses.forEach((tplClass) => {
			if (!tplClass.startsWith('-tpl--')) {
				finalClass += tplClass + ' ';
			}
		});

		finalClass = finalClass.trim();

		return ` 'class': "${finalClass}", `;
	}

	private getHtmlNodeAttrs(domNode: Element, isComponent: boolean): string {
		let attrsHtml = '{';
		attrsHtml += this.makeClassAttr(domNode.getAttribute('class'), isComponent);

		Array.from(domNode.attributes).forEach((attr) => {
			const attrName = attr.name;
			let attrValue = attr.value;

			if (attrName === 'data-cb') return;
			if (attrName === 'class') return;

			// Use JSON.stringify to properly escape newlines, quotes and other characters
			const valueLiteral = JSON.stringify(attrValue);

			// Simplified logic compared to PHP which had cbt.prefixize... calls
			// Assuming we just output the value for now as I don't see cbt implementation here
			// The PHP code imported CoreBuilderTools but here we might not have it.
			// The user's example output imports from 'chispa'.
			// I will stick to simple string values for now unless I see cbt in chispa.

			if (attrName === 'style') {
				// PHP called cbt.prefixizeStyle, but also had parse_style static method.
				// Wait, the PHP code used cbt.prefixizeStyle inside get_html_node_attrs.
				// But parse_style was defined but not used in the snippet I read?
				// Ah, I should check if I should use parseStyle or just output string.
				// The PHP code: $attrs_html .= " '$attr_name': cbt.prefixizeStyle('$attr_value'), ";
				// If cbt is a runtime helper, I should output the call.
				// But wait, the generated code imports CoreBuilderTools.
				// Does 'chispa' export CoreBuilderTools?
				// src/index.ts does NOT export CoreBuilderTools.
				// It exports appendChild, getItem, etc.
				// Maybe I should just output the string for now.
				attrsHtml += ` '${attrName}': ${valueLiteral}, `;
			} else {
				attrsHtml += ` '${attrName}': ${valueLiteral}, `;
			}
		});

		attrsHtml += '}';
		return attrsHtml;
	}

	private buildTsForNode(domNode: Node, isComponent = false): string {
		let htmlNodeCode = '';

		if (domNode.nodeType === 1) {
			// Element
			const element = domNode as Element;
			let tagName = element.tagName;

			if (tagName === 'svg') {
				this.inSvgContext++;
			}

			let cbid = element.getAttribute('data-cb');

			if (cbid) {
				const currComp = this.stack[0];
				element.removeAttribute('data-cb');
				cbid = HtmlCompiler.camelize(cbid);
				// Pushear a todos los padres
				for (const comp of this.stack) {
					if (!this.componentsItems[comp]) {
						this.componentsItems[comp] = [];
					}
					this.componentsItems[comp].push(cbid);
				}

				this.stack.unshift(cbid);
				this.components[cbid] = this.buildTsForNode(element, true);
				this.componentsTags[cbid] = element.tagName;
				this.isSvg[cbid] = this.inSvgContext > 0;
				this.stack.shift();

				if (currComp === 'fragment') {
					htmlNodeCode += `getItem(template, props, '${cbid}')`;
				} else {
					htmlNodeCode += `getItem(template, props.nodes, '${cbid}')`;
				}
			} else {
				const attrs = this.getHtmlNodeAttrs(element, isComponent);

				if (!this.inSvgContext) {
					tagName = tagName.toLowerCase();
					htmlNodeCode += `(() => { const node = document.createElement('${tagName}');\n`;
				} else {
					htmlNodeCode += `(() => { const node = document.createElementNS('${SVG_NAMESPACE}', '${tagName}');\n`;
				}

				htmlNodeCode += `setAttributes(node, ${attrs});\n`;
				if (isComponent) {
					htmlNodeCode += `setProps(node, props);\n`;
				}

				let subTs = '';
				element.childNodes.forEach((child) => {
					const chCode = this.buildTsForNode(child);
					if (chCode) {
						subTs += `appendChild(node, ${chCode});\n`;
					}
				});

				if (!VOID_ELEMENTS.includes(tagName.toLowerCase())) {
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

				if (tagName === 'svg') {
					this.inSvgContext--;
				}
			}
		} else if (domNode.nodeType === 3) {
			// Text
			const textNode = domNode as Text;
			const parent = textNode.parentNode as Element;
			const parentTag = parent ? parent.tagName.toLowerCase() : '';

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
		const body = this.htmlDocument.querySelector('body');
		if (!body) throw new Error('Not valid HTML');

		let rendererJsx = '(() => { const fragment = document.createDocumentFragment();\n';

		body.childNodes.forEach((child) => {
			const chCode = this.buildTsForNode(child);
			if (chCode) {
				rendererJsx += `appendChild(fragment, ${chCode});\n`;
			}
		});

		rendererJsx += 'return fragment;\n';
		rendererJsx += '})()';

		this.components['fragment'] = rendererJsx;
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
			return `interface ${typename} ${itemsType}`;
		} else {
			const tagname = this.componentsTags[cbid];
			if (this.isSvg[cbid]) {
				return `type ${typename} = ChispaNodeBuilderPropsReactive<SVGElementTagNameMap['${tagname}'], ${itemsType}>;`;
			} else {
				return `type ${typename} = ChispaNodeBuilderPropsReactive<HTMLElementTagNameMap['${tagname.toLowerCase()}'], ${itemsType}>;`;
			}
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

		const jsOutput = `
            import { appendChild, getItem, setAttributes, setProps } from 'chispa';
            import type { ChispaContentReactive, ChispaNodeBuilderPropsReactive } from 'chispa';
			
            const SVG_NS = 'http://www.w3.org/2000/svg';
            
            const template = {
                ${componentsClasses}
            };
            
            export default template;
        `;

		const dtsOutput = `
            import type { ChispaContentReactive, ChispaNodeBuilderPropsReactive } from 'chispa';
            
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
