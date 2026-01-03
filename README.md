# chispa

**Chispa** es un framework de interfaz de usuario (UI) totalmente declarativo y reactivo para construir aplicaciones web modernas. Se centra en la simplicidad, el rendimiento y una gestión del estado intuitiva mediante señales (signals).

## Características

-   ⚡ **Reactividad Fina**: Basado en Signals para actualizaciones precisas y eficientes del DOM.
-   🧩 **Componentes Funcionales**: Crea componentes reutilizables con funciones simples.
-   📄 **Plantillas HTML**: Separa la lógica de la vista importando archivos HTML directamente.
-   🛠️ **Integración con Vite**: Incluye un plugin de Vite para una experiencia de desarrollo fluida.
-   📦 **Ligero**: Sin dependencias pesadas en tiempo de ejecución.

## Instalación

Instala `chispa` en tu proyecto:

```bash
npm install chispa
```

## Configuración (Vite)

Para usar las plantillas HTML, necesitas configurar el plugin de Chispa en tu `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { chispaHtmlPlugin } from 'chispa';

export default defineConfig({
	plugins: [chispaHtmlPlugin()],
});
```

## Uso Básico

### 1. Crear un Componente

Chispa permite definir la estructura de tu componente en un archivo HTML y la lógica en TypeScript.

**my-component.html**
Usa el atributo `data-cb` para marcar elementos que serán controlados por tu código.

```html
<div class="my-app">
	<h1>Contador: <span data-cb="countDisplay">0</span></h1>
	<button data-cb="incrementBtn">Incrementar</button>
</div>
```

**my-component.ts**

```typescript
import { component, signal } from 'chispa';
import tpl from './my-component.html'; // Importa el HTML procesado

export const MyComponent = component(() => {
	// Estado reactivo
	const count = signal(0);

	// Retorna el fragmento enlazando los elementos del HTML
	return tpl.fragment({
		// Enlaza el contenido del span con la señal
		countDisplay: { inner: count },

		// Enlaza el evento click del botón
		incrementBtn: {
			onclick: () => count.update((v) => v + 1),
		},
	});
});
```

### 2. Montar la Aplicación

**main.ts**

```typescript
import { appendChild } from 'chispa';
import { MyComponent } from './my-component';

appendChild(document.body, MyComponent());
```

## API Principal

### Reactividad

-   **`signal(initialValue)`**: Crea una señal reactiva.

    ```typescript
    const count = signal(0);
    console.log(count.get()); // Leer valor
    count.set(5); // Establecer valor
    ```

-   **`computed(() => ...)`**: Crea una señal derivada que se actualiza automáticamente cuando sus dependencias cambian.
    ```typescript
    const double = computed(() => count.get() * 2);
    ```

### Componentes

-   **`component<Props>((props) => ...)`**: Define un nuevo componente.
-   **`appendChild(parent, child)`**: Función auxiliar para montar componentes en el DOM.

## Licencia

MIT
