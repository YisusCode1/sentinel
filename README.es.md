# React + TypeScript + Vite
[🇬🇧 Read in English](README.md)

Esta plantilla proporciona una configuración mínima para trabajar con React en Vite, incluyendo HMR (reemplazo de módulos en caliente) y algunas reglas de Oxlint.

Actualmente, hay dos complementos oficiales disponibles:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) utiliza [Oxc](https://oxc.rs).
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) utiliza [SWC](https://swc.rs/).

## React Compiler

El compilador de React (*React Compiler*) no está habilitado en esta plantilla debido a su impacto en el rendimiento durante el desarrollo y la compilación.

Si deseas incorporarlo, consulta la [documentación oficial](https://react.dev/learn/react-compiler/installation).

## Ampliación de la configuración de Oxlint

Si estás desarrollando una aplicación para producción, recomendamos habilitar las reglas de análisis estático que tienen en cuenta los tipos de TypeScript.

Para ello, instala `oxlint-tsgolint` y modifica el archivo `.oxlintrc.json` con la siguiente configuración:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

Consulta la [documentación de las reglas de Oxlint](https://oxc.rs/docs/guide/usage/linter/rules) para conocer la lista completa de reglas y categorías disponibles.
## Asistente de IA de Sentinel

Consulta [la guía de instalación y demostración](docs/ai_assistant.md) para levantar
el sistema completo con Docker o localmente, crear un agente y probar el chat.
