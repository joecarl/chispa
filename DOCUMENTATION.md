# Documentación de Chispa

**Chispa** es un framework de interfaz de usuario (UI) totalmente declarativo y reactivo para construir aplicaciones web. Se centra en el uso de señales (signals) para la gestión del estado y una compilación inteligente de plantillas HTML para generar código TypeScript eficiente.

## Instalación

```bash
npm install chispa
```

## Configuración del Proyecto (Vite)

Chispa utiliza un plugin de Vite para transformar tus archivos HTML en módulos TypeScript importables.

1.  Asegúrate de tener `vite` instalado.
2.  Configura `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { chispaHtmlPlugin } from 'chispa/vite-plugin';

export default defineConfig({
	plugins: [chispaHtmlPlugin()],
});
```

Esto permite importar archivos `.html` directamente en tus archivos `.ts`.

## Conceptos Principales

### 1. Señales (Signals)

El estado en Chispa se maneja mediante señales.

-   **`signal(initialValue)`**: Crea una señal de escritura.
-   **`computed(fn)`**: Crea una señal de solo lectura que depende de otras señales.
-   **`.get()`**: Obtiene el valor actual (registra la dependencia si se llama dentro de un contexto reactivo).
-   **`.update(fn)`**: Actualiza el valor de una señal.

```typescript
import { signal, computed } from 'chispa';

const count = signal(0);
const doubleCount = computed(() => count.get() * 2);

console.log(count.get()); // 0
count.update((v) => v + 1);
console.log(doubleCount.get()); // 2
```

### 2. Componentes

Los componentes se definen usando la función `component`. Un componente es una función que recibe `props` y devuelve una estructura de nodos (generalmente creada a partir de una plantilla).

```typescript
import { component } from 'chispa';
import tpl from './my-component.html';

export const MyComponent = component(() => {
	return tpl.fragment({
		// ... props y bindings
	});
});
```

### 3. Plantillas HTML y `data-cb`

Chispa separa la estructura (HTML) de la lógica (TS). En tus archivos HTML, utilizas el atributo `data-cb` (Callback Data) para identificar los elementos que necesitas controlar desde tu código.

**my-component.html**

```html
<div>
	<span data-cb="my-text">Texto inicial</span>
	<button data-cb="my-button">Click me</button>
</div>
```

El compilador generará un objeto `tpl` donde cada `data-cb` se convierte en una función constructora (camelCase).

-   `data-cb="my-text"` -> `tpl.myText(...)`
-   `data-cb="my-button"` -> `tpl.myButton(...)`
-   Si el HTML tiene múltiples elementos raíz o quieres agruparlos, usa `tpl.fragment(...)`.

## Guía de Uso

### Binding de Propiedades

Puedes enlazar señales o valores estáticos a las propiedades de los elementos DOM.

-   **`inner`**: Controla el contenido (texto o hijos).
-   **`style`**: Objeto con estilos CSS.
-   **`classes`**: Objeto para clases condicionales `{ 'active': isActiveSignal }`.
-   **Eventos**: `onclick`, `oninput`, etc.

```typescript
import { component, signal } from 'chispa';
import tpl from './counter.html';

export const Counter = component(() => {
	const count = signal(0);

	return tpl.fragment({
		myText: {
			inner: count, // Binding directo de la señal
			style: {
				color: computed(() => (count.get() > 5 ? 'red' : 'black')),
			},
		},
		myButton: {
			onclick: () => count.update((v) => v + 1),
		},
	});
});
```

### Listas (`componentList`)

Para renderizar listas dinámicas, usa `componentList`.

```typescript
import { componentList } from 'chispa';

// Definición de la lista
const MyList = componentList<ItemType>(
	// Factory function: crea cada item
	(itemSignal, indexSignal, listSignal) => {
		return tpl.listItem({
			nodes: {
				itemName: { inner: itemSignal.computed.name },
			},
		});
	},
	// Key function: identificador único
	(item) => item.id
);

// Uso en un componente padre
const items = signal([
	{ id: 1, name: 'A' },
	{ id: 2, name: 'B' },
]);
// ...
return tpl.container({
	inner: MyList(items),
});
```

### Referencias a Nodos Internos (`nodes`)

Si un elemento con `data-cb` contiene otros elementos con `data-cb` dentro de él (descendientes), puedes acceder a ellos mediante la propiedad `nodes`.

**HTML**

```html
<div data-cb="card">
	<h1 data-cb="title"></h1>
	<p data-cb="content"></p>
</div>
```

**TS**

```typescript
tpl.card({
	nodes: {
		title: { inner: 'Hola Mundo' },
		content: { inner: 'Descripción...' },
	},
});
```

## API Reference

### `component<TProps>(factoryFn)`

Crea un componente. `factoryFn` recibe `props` (que son señales) y debe retornar un nodo o estructura de nodos.

### `signal(value)` / `computed(fn)`

Primitivas de reactividad.

### `componentList<T>(itemFactory, keyFn)`

Crea un componente de lista optimizado. Retorna una función que acepta una `WritableSignal<T[]>`.

### `appendChild(parent, child)`

Utilidad para montar la aplicación o componentes manualmente.

```typescript
import { appendChild } from 'chispa';
import { App } from './app';

appendChild(document.body, App());
```
