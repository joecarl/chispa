import { component, computed, type Signal, signal } from 'chispa';
import tpl from './home-component.html';

interface IDivSimpaticoProps {
	length: Signal<number>;
}

const DivSimpatico = component<IDivSimpaticoProps>((props) => {
	const text = computed(() => {
		const length = props.length.get();
		if (length < 2) return '?';
		if (length < 5) return 'Sigue';
		if (length < 9) return 'Sigue, sigue';
		if (length < 15) return 'Nada mal, continúa';
		if (length < 20) return 'Suficiente';
		return 'No te esfuerces más, puedo oler la asíntota.';
	});

	const width = computed(() => {
		const w0 = 5;
		const exp = props.length.get();
		return 100 - (100 - w0) * Math.pow(0.9, exp);
	});

	return tpl.eldiv({
		inner: text,
		style: { width: () => width.get() + '%' },
	});
});

function makeColor(length: number) {
	if (length < 2) return '#ccc';
	if (length < 5) return '#8f8';
	if (length < 9) return '#88f';
	if (length < 15) return '#fa8';
	if (length < 20) return '#f88';
	return '#f44';
}

export const Home = component(() => {
	const length = signal(1);

	return tpl.fragment({
		elspan: {
			inner: length,
			style: { backgroundColor: () => makeColor(length.get()) },
			classes: { highlighted: () => length.get() >= 10 },
		},
		eldiv: DivSimpatico({ length }),
		incBtn: {
			onclick: () => {
				length.update((v) => v + 1);
			},
		},
	});
});
