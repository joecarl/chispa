/**
 * Clase que intercepta eventos de modificación en inputs, previene cambios directos,
 * emite eventos sintéticos y aplica cambios usando execCommand
 *
 * Uso básico:
 * ```typescript
 * const interceptor = new InputInterceptor(inputElement);
 *
 * // Escuchar cambios solicitados
 * inputElement.addEventListener('change-requested', (event) => {
 *   const { oldValue, proposedValue } = event.detail;
 *
 *   // Aplicar validaciones/transformaciones
 *   let finalValue = proposedValue.toUpperCase();
 *
 *   // Aplicar el valor usando execCommand
 *   interceptor.applyValue(finalValue);
 * });
 * ```
 */
export class InputInterceptor {
	private element: HTMLInputElement;
	private lastValue: string;
	private isApplyingChange: boolean = false;

	constructor(element: HTMLInputElement) {
		this.element = element;
		this.lastValue = element.value;
		this.init();
	}

	private init(): void {
		// Interceptar todos los eventos que pueden modificar el input
		this.element.addEventListener('input', this.handleInput.bind(this));
		this.element.addEventListener('keydown', this.handleKeydown.bind(this));
		this.element.addEventListener('paste', this.handlePaste.bind(this));
		this.element.addEventListener('cut', this.handleCut.bind(this));
		this.element.addEventListener('drop', this.handleDrop.bind(this));
	}

	private handleInput(event: InputEvent): void {
		if (this.isApplyingChange) return;

		event.preventDefault();
		event.stopPropagation();
		if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
			// Permitir deshacer/rehacer sin intervención
			this.lastValue = this.element.value;
			return;
		}
	}

	private handleKeydown(event: KeyboardEvent): void {
		if (this.isApplyingChange) return;

		// Interceptar teclas que modifican contenido
		const modifyingKeys = ['Backspace', 'Delete', 'Enter'];
		const isChar = event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey;

		if (modifyingKeys.includes(event.key) || isChar) {
			event.preventDefault();

			const proposedValue = this.calculateProposedValue(event);

			this.emitSyntheticEvent('change-requested', {
				oldValue: this.lastValue,
				proposedValue: proposedValue,
				inputType: this.getInputTypeFromKey(event.key),
				data: isChar ? event.key : null,
			});
		}
	}

	private handlePaste(event: ClipboardEvent): void {
		if (this.isApplyingChange) return;

		event.preventDefault();

		const pasteData = event.clipboardData?.getData('text/plain') || '';
		const proposedValue = this.calculatePasteValue(pasteData);

		this.emitSyntheticEvent('change-requested', {
			oldValue: this.lastValue,
			proposedValue: proposedValue,
			inputType: 'insertFromPaste',
			data: pasteData,
		});
	}

	private handleCut(event: ClipboardEvent): void {
		if (this.isApplyingChange) return;

		event.preventDefault();

		const proposedValue = this.calculateCutValue();

		this.emitSyntheticEvent('change-requested', {
			oldValue: this.lastValue,
			proposedValue: proposedValue,
			inputType: 'deleteByCut',
			data: null,
		});
	}

	private handleDrop(event: DragEvent): void {
		if (this.isApplyingChange) return;

		event.preventDefault();

		const dropData = event.dataTransfer?.getData('text/plain') || '';
		const proposedValue = this.calculateDropValue(dropData, event);

		this.emitSyntheticEvent('change-requested', {
			oldValue: this.lastValue,
			proposedValue: proposedValue,
			inputType: 'insertFromDrop',
			data: dropData,
		});
	}

	private calculateProposedValue(event: KeyboardEvent): string {
		const start = this.element.selectionStart || 0;
		const end = this.element.selectionEnd || 0;

		switch (event.key) {
			case 'Backspace':
				if (start === end && start > 0) {
					return this.lastValue.substring(0, start - 1) + this.lastValue.substring(start);
				} else if (start !== end) {
					return this.lastValue.substring(0, start) + this.lastValue.substring(end);
				}
				return this.lastValue;

			case 'Delete':
				if (start === end && start < this.lastValue.length) {
					return this.lastValue.substring(0, start) + this.lastValue.substring(start + 1);
				} else if (start !== end) {
					return this.lastValue.substring(0, start) + this.lastValue.substring(end);
				}
				return this.lastValue;

			case 'Enter':
				return this.lastValue.substring(0, start) + '\n' + this.lastValue.substring(end);

			default:
				// Carácter normal
				if (event.key.length === 1) {
					return this.lastValue.substring(0, start) + event.key + this.lastValue.substring(end);
				}
				return this.lastValue;
		}
	}

	private calculatePasteValue(pasteData: string): string {
		const start = this.element.selectionStart || 0;
		const end = this.element.selectionEnd || 0;
		return this.lastValue.substring(0, start) + pasteData + this.lastValue.substring(end);
	}

	private calculateCutValue(): string {
		const start = this.element.selectionStart || 0;
		const end = this.element.selectionEnd || 0;
		return this.lastValue.substring(0, start) + this.lastValue.substring(end);
	}

	private calculateDropValue(dropData: string, event: DragEvent): string {
		// Simplificado: insertar en la posición actual del cursor
		const start = this.element.selectionStart || 0;
		const end = this.element.selectionEnd || 0;
		return this.lastValue.substring(0, start) + dropData + this.lastValue.substring(end);
	}

	private getInputTypeFromKey(key: string): string {
		switch (key) {
			case 'Backspace':
				return 'deleteContentBackward';
			case 'Delete':
				return 'deleteContentForward';
			case 'Enter':
				return 'insertLineBreak';
			default:
				return 'insertText';
		}
	}

	private emitSyntheticEvent(type: string, detail: any): void {
		const syntheticEvent = new CustomEvent(type, {
			detail,
			bubbles: true,
			cancelable: false,
		});

		this.element.dispatchEvent(syntheticEvent);
	}

	/**
	 * Aplica un nuevo valor usando execCommand para insertar/eliminar texto de manera diferencial
	 */
	public applyValue(newValue: string): void {
		if (this.getValue() === newValue) return;
		if (this.isApplyingChange) return;

		this.isApplyingChange = true;

		try {
			// Enfocar el elemento para que execCommand funcione
			this.element.focus();

			// Calcular diferencias entre valor actual y nuevo valor
			const diff = this.calculateTextDiff(this.lastValue, newValue);

			// Aplicar cada operación
			for (const operation of diff.operations) {
				this.applyOperation(operation);
			}

			this.lastValue = newValue;
		} finally {
			this.isApplyingChange = false;
		}
	}

	private calculateTextDiff(
		oldText: string,
		newText: string
	): { operations: Array<{ type: 'insert' | 'delete'; position: number; text?: string; count?: number }> } {
		const operations: Array<{ type: 'insert' | 'delete'; position: number; text?: string; count?: number }> = [];

		// Algoritmo simple de diferencias
		let i = 0;
		let j = 0;

		while (i < oldText.length || j < newText.length) {
			if (i >= oldText.length) {
				// Insertar resto del nuevo texto
				operations.push({
					type: 'insert',
					position: i,
					text: newText.substring(j),
				});
				break;
			} else if (j >= newText.length) {
				// Eliminar resto del texto antiguo
				operations.push({
					type: 'delete',
					position: i,
					count: oldText.length - i,
				});
				break;
			} else if (oldText[i] === newText[j]) {
				// Caracteres iguales, avanzar
				i++;
				j++;
			} else {
				// Encontrar la siguiente coincidencia
				let nextMatch = this.findNextMatch(oldText, newText, i, j);

				if (nextMatch) {
					// Hay caracteres a insertar y/o eliminar
					if (nextMatch.deleteCount > 0) {
						operations.push({
							type: 'delete',
							position: i,
							count: nextMatch.deleteCount,
						});
					}
					if (nextMatch.insertText) {
						operations.push({
							type: 'insert',
							position: i,
							text: nextMatch.insertText,
						});
					}
					i += nextMatch.deleteCount;
					j += nextMatch.insertText.length;
				} else {
					// No hay más coincidencias, reemplazar el resto
					if (i < oldText.length) {
						operations.push({
							type: 'delete',
							position: i,
							count: oldText.length - i,
						});
					}
					if (j < newText.length) {
						operations.push({
							type: 'insert',
							position: i,
							text: newText.substring(j),
						});
					}
					break;
				}
			}
		}

		return { operations };
	}

	private findNextMatch(oldText: string, newText: string, startOld: number, startNew: number): { deleteCount: number; insertText: string } | null {
		// Buscar la siguiente posición donde coincidan los textos
		for (let i = startOld; i <= oldText.length; i++) {
			for (let j = startNew; j <= newText.length; j++) {
				if (i < oldText.length && j < newText.length && oldText[i] === newText[j]) {
					// Encontrada coincidencia
					return {
						deleteCount: i - startOld,
						insertText: newText.substring(startNew, j),
					};
				}
			}
		}
		return null;
	}

	private applyOperation(operation: { type: 'insert' | 'delete'; position: number; text?: string; count?: number }): void {
		// Posicionar cursor
		this.element.setSelectionRange(operation.position, operation.position);

		if (operation.type === 'insert' && operation.text) {
			// Usar execCommand para insertar texto
			document.execCommand('insertText', false, operation.text);
		} else if (operation.type === 'delete' && operation.count) {
			// Seleccionar texto a eliminar y usar execCommand para eliminarlo
			this.element.setSelectionRange(operation.position, operation.position + operation.count);
			document.execCommand('delete', false);
		}
	}

	/**
	 * Obtiene el valor actual almacenado (no necesariamente el valor del DOM)
	 */
	public getValue(): string {
		return this.lastValue;
	}

	/**
	 * Destruye el interceptor y restaura el comportamiento normal
	 */
	public destroy(): void {
		this.element.removeEventListener('input', this.handleInput.bind(this));
		this.element.removeEventListener('keydown', this.handleKeydown.bind(this));
		this.element.removeEventListener('paste', this.handlePaste.bind(this));
		this.element.removeEventListener('cut', this.handleCut.bind(this));
		this.element.removeEventListener('drop', this.handleDrop.bind(this));
	}
}
