import { component, Link, Router, lang, pathMatches, t } from 'chispa';
import { DemoTable } from '../demo-table-component/demo-table-component';
import { DemoForm } from '../demo-form-component/demo-form-component';
import { DemoNested } from '../demo-nested-component/demo-nested-component';
import { DemoMisc } from '../demo-misc/demo-misc';
import { Home } from '../home-component/home-component';
import tpl from './my-app-component.html';

export const MyApp = component(() => {
	const linksData = [
		{ to: '/', inner: 'Inicio' },
		{ to: '/table', inner: 'Tabla Demo' },
		{ to: '/form', inner: 'Formulario Demos' },
		{ to: '/nested', inner: 'Componente Anidado' },
		{ to: '/misc', inner: 'Misc' },
	];

	// Al usar datos estaticos, podemos crear una lista de componentes Link sin necesidad de
	// usar componentList, ya que no hay reactividad en la lista. El texto de cada enlace
	// sí es reactivo: t() devuelve un signal que sigue al idioma actual.
	const links = linksData.map((link) =>
		Link({
			to: link.to,
			inner: t(link.inner),
			classes: { 'active-link': pathMatches(link.to) },
		})
	);

	return tpl.fragment({
		langBtn: {
			inner: () => (lang.get() === 'en' ? 'Español' : 'English'),
			onclick: () => lang.update((current) => (current === 'en' ? 'es' : 'en')),
		},
		links: { inner: links },
		routerAnchor: Router({
			routes: [
				{ path: '/', component: Home },
				{ path: '/table', component: DemoTable },
				{ path: '/form', component: DemoForm },
				{ path: '/nested', component: DemoNested },
				{ path: '/misc', component: DemoMisc },
			],
		}),
	});
});
