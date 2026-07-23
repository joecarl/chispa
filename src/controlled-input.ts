import { appendChild, setProps } from './builder';
import { componentList } from './components';
import { globalContext } from './context';
import { computed, isSignal, Signal, WritableSignal } from './signals';

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

export type InputValueType = string | number;

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
	valueSignal: WritableSignal<T>,
	options: ControlledInputOptions<T> = {}
) {
	const { transform, validate } = options;

	// Get type converters based on the initial value type
	const { toTargetType, fromTargetType } = getTypeConverter(valueSignal.initialValue);

	// Initialize value
	element.value = fromTargetType(valueSignal.initialValue);

	// Handle input events
	const handleInput = (e: Event) => {
		const target = e.target as HTMLInputElement;
		let newValue = toTargetType(target.value);
		const originalValue = valueSignal.get();

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
			valueSignal.set(newValue);
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
		const newValueStr = fromTargetType(valueSignal.get());
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

export function bindControlledCheckbox(element: HTMLInputElement, valueSignal: WritableSignal<boolean>, indeterminate?: Signal<boolean>) {
	// Initialize checked state
	element.checked = valueSignal.initialValue;

	// Handle change events
	const handleChange = (e: Event) => {
		const target = e.target as HTMLInputElement;
		let newChecked = target.checked;
		const originalValue = valueSignal.get();

		// Update signal
		if (newChecked !== originalValue) {
			valueSignal.set(newChecked);
		}

		// Force update DOM if it doesn't match the new value
		if (target.checked !== newChecked) {
			target.checked = newChecked;
		}
	};

	element.addEventListener('change', handleChange);

	// Subscribe to signal changes to update the checkbox if it changes externally
	globalContext.addReactivity(() => {
		const newValue = valueSignal.get();
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

export function bindControlledSelect(element: HTMLSelectElement, valueSignal: WritableSignal<string>, optionList?: Signal<SelectOption[]> | SelectOption[]) {
	const Options = componentList<SelectOption>(
		(option) => {
			const optElement = document.createElement('option');
			setProps(optElement, {
				value: () => option.get().value ?? '',
				textContent: () => option.get().label ?? '',
				disabled: () => option.get().disabled ?? false,
			});
			return optElement;
		},
		(o) => o.value
	);

	// Handle change events
	const handleChange = (e: Event) => {
		const target = e.target as HTMLSelectElement;
		let newValue = target.value;
		const originalValue = valueSignal.get();

		// Update signal
		if (newValue !== originalValue) {
			valueSignal.set(newValue);
		}

		// Force update DOM if it doesn't match the new value (e.g. transformed or rejected)
		if (target.value !== newValue) {
			target.value = newValue;
		}
	};

	// Subscribe to options signal changes if provided
	if (optionList) {
		const optionsSignal = isSignal(optionList) ? optionList : computed(() => optionList || []);

		element.innerHTML = '';
		appendChild(element, Options(optionsSignal));
		globalContext.addReactivity(() => {
			const currValue = valueSignal.get();
			// If the current value is not in the new options, reset it
			if (!optionsSignal.get().some((opt) => opt.value === currValue)) {
				element.value = '';
			} else if (element.value !== currValue) {
				element.value = currValue;
			}
		});
	}

	// Subscribe to signal changes to update the select if it changes externally
	globalContext.addReactivity(() => {
		const newValue = valueSignal.get();
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

// --- Ref binding helpers ----------------------------------------------------

export function refBindInput<T extends InputValueType>(valueSignal: WritableSignal<T>, options: ControlledInputOptions<T> = {}) {
	return (el: HTMLInputElement | HTMLTextAreaElement) => {
		bindControlledInput<T>(el, valueSignal, options);
	};
}

export function refBindCheckbox(valueSignal: WritableSignal<boolean>, indeterminate?: Signal<boolean>) {
	return (el: HTMLInputElement) => {
		bindControlledCheckbox(el, valueSignal, indeterminate);
	};
}

export function refBindSelect(valueSignal: WritableSignal<string>, optionList?: Signal<SelectOption[]> | SelectOption[]) {
	return (el: HTMLSelectElement) => {
		bindControlledSelect(el, valueSignal, optionList);
	};
}
