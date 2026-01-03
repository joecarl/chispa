import { WritableSignal, globalContext } from 'chispa';

export interface ControlledInputOptions {
	/**
	 * Optional function to transform the value before setting it to the signal.
	 * Useful for enforcing uppercase, removing invalid characters, etc.
	 */
	transform?: (value: string) => string;

	/**
	 * Optional function to validate the value.
	 * If it returns false, the change is rejected and the previous value is restored.
	 */
	validate?: (value: string) => boolean;
}

export function bindControlledInput(element: HTMLInputElement | HTMLTextAreaElement, signal: WritableSignal<string>, options: ControlledInputOptions = {}) {
	const { transform, validate } = options;

	// Initialize value
	element.value = signal.initialValue;

	// Handle input events
	const handleInput = (e: Event) => {
		const target = e.target as HTMLInputElement;
		let newValue = target.value;
		const originalValue = signal.get();

		// Save cursor position
		const selectionStart = target.selectionStart;
		const selectionEnd = target.selectionEnd;

		// Apply transformation if provided
		if (transform) {
			newValue = transform(newValue);
		}

		// Apply validation if provided
		if (validate && !validate(newValue)) {
			// If invalid, revert to original value
			newValue = originalValue;
		}

		// Update signal
		if (newValue !== originalValue) {
			signal.set(newValue);
		}

		// Force update DOM if it doesn't match the new value (e.g. transformed or rejected)
		if (target.value !== newValue) {
			target.value = newValue;

			// Restore cursor
			if (selectionStart !== null && selectionEnd !== null) {
				// Restore to the saved position.
				// Note: If the transformation changed the length significantly, this might need more complex logic,
				// but for common cases (uppercase, masking) this works reasonably well.
				target.setSelectionRange(selectionStart, selectionEnd);
			}
		}
	};

	element.addEventListener('input', handleInput);

	// Subscribe to signal changes to update the input if it changes externally
	globalContext.addReactivity(() => {
		const newValue = signal.get();
		// Only update if the value is actually different to avoid cursor jumping
		if (element.value !== newValue) {
			element.value = newValue;
		}
	});

	// Return a cleanup function
	return () => {
		element.removeEventListener('input', handleInput);
	};
}
