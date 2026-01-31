import { globalContext } from './context';
import { Signal, WritableSignal } from './signals';

export interface ControlledInputOptions<T> {
	/**
	 * Optional function to transform the value before setting it to the signal.
	 * Useful for enforcing uppercase, removing invalid characters, etc.
	 */
	transform?: (value: T) => T;

	/**
	 * Optional function to validate the value.
	 * If it returns false, the change is rejected and the previous value is restored.
	 */
	validate?: (value: T) => boolean;
}

export interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
}

type InputValueType = string | number;

interface TypeConverter<T extends InputValueType> {
	toTargetType: (val: string) => T;
	fromTargetType: (val: T) => string;
}

function getTypeConverter<T extends InputValueType>(exampleValue: T): TypeConverter<T> {
	// TODO: Extend for other types if needed. Also support partial parsing/formatting with invalid intermediate states (e.g. for dates or decimals)
	if (typeof exampleValue === 'number') {
		return {
			toTargetType: (val: string) => Number(val) as T,
			fromTargetType: (val: T) => val.toString(),
		} as const;
	} else {
		return {
			toTargetType: (val: string) => val as T,
			fromTargetType: (val: T) => val as string,
		} as const;
	}
}

export function bindControlledInput<T extends InputValueType>(
	element: HTMLInputElement | HTMLTextAreaElement,
	signal: WritableSignal<T>,
	options: ControlledInputOptions<T> = {}
) {
	const { transform, validate } = options;

	// Get type converters based on the initial value type
	const { toTargetType, fromTargetType } = getTypeConverter(signal.initialValue);

	// Initialize value
	element.value = fromTargetType(signal.initialValue);

	// Handle input events
	const handleInput = (e: Event) => {
		const target = e.target as HTMLInputElement;
		let newValue = toTargetType(target.value);
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
		const newValueStr = fromTargetType(newValue);
		if (target.value !== newValueStr) {
			const lengthDiff = target.value.length - newValueStr.length;
			target.value = newValueStr;

			// Restore cursor
			if (selectionStart !== null && selectionEnd !== null) {
				// Restore to the saved position.
				// Adjust for length difference to keep cursor relative to the content
				const newStart = Math.max(0, selectionStart - lengthDiff);
				const newEnd = Math.max(0, selectionEnd - lengthDiff);
				target.setSelectionRange(newStart, newEnd);
			}
		}
	};

	element.addEventListener('input', handleInput);

	// Subscribe to signal changes to update the input if it changes externally
	globalContext.addReactivity(() => {
		const newValueStr = fromTargetType(signal.get());
		// Only update if the value is actually different to avoid cursor jumping
		if (element.value !== newValueStr) {
			element.value = newValueStr;
		}
	});

	// Return a cleanup function
	return () => {
		element.removeEventListener('input', handleInput);
	};
}

export function bindControlledCheckbox(element: HTMLInputElement, signal: WritableSignal<boolean>, indeterminate?: Signal<boolean>) {
	// Initialize checked state
	element.checked = signal.initialValue;

	// Handle change events
	const handleChange = (e: Event) => {
		const target = e.target as HTMLInputElement;
		let newChecked = target.checked;
		const originalValue = signal.get();

		// Update signal
		if (newChecked !== originalValue) {
			signal.set(newChecked);
		}

		// Force update DOM if it doesn't match the new value
		if (target.checked !== newChecked) {
			target.checked = newChecked;
		}
	};

	element.addEventListener('change', handleChange);

	// Subscribe to signal changes to update the checkbox if it changes externally
	globalContext.addReactivity(() => {
		const newValue = signal.get();
		if (element.checked !== newValue) {
			element.checked = newValue;
		}
	});

	// Subscribe to indeterminate signal if provided as a Signal
	if (indeterminate) {
		globalContext.addReactivity(() => {
			element.indeterminate = indeterminate.get();
		});
	}

	// Return a cleanup function
	return () => {
		element.removeEventListener('change', handleChange);
	};
}

export function bindControlledSelect(element: HTMLSelectElement, signal: WritableSignal<string>, optionsSignal?: Signal<SelectOption[]>) {
	// Function to update options
	const updateOptions = (options: SelectOption[]) => {
		// Clear existing options
		element.innerHTML = '';
		// Add new options
		options.forEach((option) => {
			const optElement = document.createElement('option');
			optElement.value = option.value;
			optElement.textContent = option.label;
			if (option.disabled) {
				optElement.disabled = true;
			}
			element.appendChild(optElement);
		});
		// Ensure the current value is set
		element.value = signal.get();
	};

	// Handle change events
	const handleChange = (e: Event) => {
		const target = e.target as HTMLSelectElement;
		let newValue = target.value;
		const originalValue = signal.get();

		// Update signal
		if (newValue !== originalValue) {
			signal.set(newValue);
		}

		// Force update DOM if it doesn't match the new value (e.g. transformed or rejected)
		if (target.value !== newValue) {
			target.value = newValue;
		}
	};

	// Subscribe to options signal changes if provided
	if (optionsSignal) {
		globalContext.addReactivity(() => {
			updateOptions(optionsSignal.get());
		});
	}

	// Subscribe to signal changes to update the select if it changes externally
	globalContext.addReactivity(() => {
		const newValue = signal.get();
		// Only update if the value is actually different
		if (element.value !== newValue) {
			element.value = newValue;
		}
	});

	element.addEventListener('change', handleChange);

	// Return a cleanup function
	return () => {
		element.removeEventListener('change', handleChange);
	};
}
