import { MyApp } from './my-app-component/my-app-component';
import { mountRoot, enableDebugging } from 'chispa';

// Development warnings only; production builds drop this call
if (import.meta.env.DEV) enableDebugging();

const root = document.getElementById('app');
if (root) {
	mountRoot(MyApp(), root);
}
