import { MyApp } from './my-app-component/my-app-component';
import { mountRoot, enableDebugging, registerTranslations } from 'chispa';
import en from './locales/en.json';

// Development warnings only; production builds drop this call
if (import.meta.env.DEV) enableDebugging();

// The templates are written in Spanish (the `lang` of index.html); this is the English catalog
registerTranslations('en', en);

const root = document.getElementById('app');
if (root) {
	mountRoot(MyApp(), root);
}
