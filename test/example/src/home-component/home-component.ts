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
		return '¡Ya vale! como sigas así, esto va a acabar mal';
	});

	return tpl.eldiv({
		inner: text,
		style: { width: computed(() => 2 * props.length.get() + 'em') },
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
