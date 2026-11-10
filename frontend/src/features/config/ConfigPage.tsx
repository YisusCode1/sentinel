import { useState } from "react";
import { Check, Database, Info, Key, Server, Settings, ShieldCheck, Trash2 } from "lucide-react";
import CollapsibleBanner from "../../components/ui/CollapsibleBanner";
import Button from "../../components/ui/Button";
import { API_BASE_URL, hasApiKey, setApiKey } from "../../lib/api";
import { useToast } from "../../components/ui/ToastProvider";
import "./config.css";

interface Props {
  active: boolean;
  backendOnline: boolean;
}

export default function ConfigPage({ active, backendOnline }: Props) {
  const notify = useToast();
  const [keyInput, setKeyInput] = useState("");
  const [isKeyConfigured, setIsKeyConfigured] = useState(hasApiKey());
  const [showKey, setShowKey] = useState(false);

  function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    const cleanKey = keyInput.trim();
    if (!cleanKey) {
      notify({ title: "Clave vacía", description: "Por favor ingresa una API Key válida.", tone: "error" });
      return;
    }
    setApiKey(cleanKey);
    setIsKeyConfigured(true);
    setKeyInput("");
    notify({
      title: "API Key guardada en memoria",
      description: "La autenticación se enviará mediante la cabecera X-API-Key durante esta sesión.",
      tone: "success",
    });
  }

  function handleClearKey() {
    setApiKey(null);
    setIsKeyConfigured(false);
    setKeyInput("");
    notify({
      title: "API Key eliminada de memoria",
      description: "Las peticiones ya no incluirán cabecera X-API-Key.",
      tone: "info",
    });
  }

  return (
    <div className="config-page" hidden={!active}>
      <div className="section-heading">
        <h2>Configuración del sistema</h2>
        <span className="demo-label">Parámetros operativos · Sentinel Seguro v3.0</span>
      </div>

      <CollapsibleBanner
        id="config-environment-info"
        title="Arquitectura de seguridad y credenciales"
        tone="info"
        icon={<Info size={18} className="banner-main-icon" aria-hidden="true" />}
        ariaLabel="Aviso de configuración"
      >
        <p>
          Sentinel utiliza autenticación estricta mediante cabecera <code>X-API-Key</code>. Las credenciales jamás se almacenan en almacenamiento persistente (localStorage o bundle del navegador), garantizando cero exposición.
        </p>
      </CollapsibleBanner>

      <div className="config-grid">
        {/* Autenticación en memoria */}
        <section className="card ops-span-full" aria-labelledby="auth-config-heading">
          <div className="card-header-row">
            <h3 id="auth-config-heading">
              <Key size={18} aria-hidden="true" />
              Autenticación de sesión (X-API-Key)
            </h3>
            <span className={`config-status-badge ${isKeyConfigured ? "active" : "inactive"}`}>
              <span className={`dot ${isKeyConfigured ? "online" : "offline"}`} aria-hidden="true" />
              {isKeyConfigured ? "Clave activa en memoria" : "Sin clave configurada"}
            </span>
          </div>

          <p className="text-sm text-slate-300 mb-4">
            Ingresa la API Key de tu agente para autenticar las operaciones y consultas ante el backend.
            La clave permanece exclusivamente en la memoria volátil de esta sesión.
          </p>

          <form onSubmit={handleSaveKey} className="space-y-3">
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type={showKey ? "text" : "password"}
                placeholder={isKeyConfigured ? "••••••••••••••••••••••••••••••••" : "Ingresa tu X-API-Key"}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="contract-address px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 flex-1 min-w-[280px]"
                autoComplete="off"
                spellCheck="false"
              />
              <Button
                variant="secondary"
                type="button"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? "Ocultar" : "Mostrar"}
              </Button>
              <Button variant="primary" type="submit">
                <Check size={16} />
                Guardar en sesión
              </Button>
              {isKeyConfigured && (
                <Button variant="secondary" type="button" onClick={handleClearKey}>
                  <Trash2 size={16} />
                  Eliminar clave
                </Button>
              )}
            </div>
            <p className="ops-field-help text-xs text-slate-400">
              Cero persistencia en disco: la clave se descartará automáticamente al cerrar la pestaña o recargar el navegador.
            </p>
          </form>
        </section>

        {/* Entorno y conexión */}
        <section className="card" aria-labelledby="env-config-heading">
          <div className="card-header-row">
            <h3 id="env-config-heading">
              <Server size={18} aria-hidden="true" />
              Entorno y conexión
            </h3>
          </div>
          <ul className="config-item-list">
            <li>
              <span className="config-item-label">URL del backend</span>
              <span className="config-item-value contract-address">{API_BASE_URL}</span>
              <span className="ops-field-help">Configurable mediante variable de entorno VITE_API_BASE_URL.</span>
            </li>
            <li>
              <span className="config-item-label">Estado de conexión</span>
              <span className={`config-status-badge ${backendOnline ? "active" : "inactive"}`}>
                <span className={`dot ${backendOnline ? "online" : "offline"}`} aria-hidden="true" />
                {backendOnline ? "Backend conectado (healthy)" : "Sin conexión con el backend"}
              </span>
            </li>
            <li>
              <span className="config-item-label">Red blockchain destino</span>
              <span className="config-item-value">NEAR Protocol Testnet (<code>near-testnet</code>)</span>
            </li>
            <li>
              <span className="config-item-label">Versión de API</span>
              <span className="config-item-value numeric">v0.1.0 (/api/v1)</span>
            </li>
          </ul>
        </section>

        {/* Persistencia y motor */}
        <section className="card" aria-labelledby="storage-config-heading">
          <div className="card-header-row">
            <h3 id="storage-config-heading">
              <Database size={18} aria-hidden="true" />
              Persistencia y motor
            </h3>
          </div>
          <ul className="config-item-list">
            <li>
              <span className="config-item-label">Motor de base de datos</span>
              <span className="config-item-value">SQLAlchemy ORM + SQLite (local) / PostgreSQL (Docker)</span>
            </li>
            <li>
              <span className="config-item-label">Precisión decimal</span>
              <span className="config-item-value">
                Hasta 30 enteros y 24 decimales con <code>Decimal</code> (sin pérdida por coma flotante IEEE 754)
              </span>
            </li>
            <li>
              <span className="config-item-label">Mecanismo de autenticación</span>
              <span className="config-item-value">
                Cabecera <code>X-API-Key</code> directa por agente
              </span>
            </li>
            <li>
              <span className="config-item-label">Reglas de autorización</span>
              <span className="config-item-value">Evaluación determinista por Policy Engine</span>
            </li>
          </ul>
        </section>

        {/* Módulos del sistema */}
        <section className="card" aria-labelledby="services-config-heading">
          <div className="card-header-row">
            <h3 id="services-config-heading">
              <Settings size={18} aria-hidden="true" />
              Módulos y roles de autoridad
            </h3>
          </div>
          <ul className="config-item-list">
            <li>
              <span className="config-item-label">Policy Engine (Autoridad exclusiva)</span>
              <span className="config-status-badge active">Activo · Autoritativo</span>
              <span className="ops-field-help">Única entidad que aprueba o rechaza solicitudes de agentes.</span>
            </li>
            <li>
              <span className="config-item-label">Gemini AI Engine (Asesor de riesgo)</span>
              <span className="config-status-badge active">Activo · Consultivo</span>
              <span className="ops-field-help">Proporciona contexto y puntuación de riesgo sin alterar decisiones de política.</span>
            </li>
            <li>
              <span className="config-item-label">Historial paginado</span>
              <span className="config-status-badge active">Implementado y operativo</span>
            </li>
            <li>
              <span className="config-item-label">Centro de alertas por rechazo</span>
              <span className="config-status-badge active">Implementado y operativo</span>
            </li>
          </ul>
        </section>

        {/* Políticas de seguridad */}
        <section className="card" aria-labelledby="security-model-heading">
          <div className="card-header-row">
            <h3 id="security-model-heading">
              <ShieldCheck size={18} aria-hidden="true" />
              Modelo de aislamiento y seguridad
            </h3>
          </div>
          <ul className="config-item-list">
            <li>
              <span className="config-item-label">Identidad de agentes</span>
              <span className="config-item-value">Derivada exclusivamente en el backend desde la API key</span>
            </li>
            <li>
              <span className="config-item-label">Cero exposición en cliente</span>
              <span className="config-item-value">Prohibida la inclusión de credenciales en bundles o variables VITE_</span>
            </li>
            <li>
              <span className="config-item-label">Control de concurrencia</span>
              <span className="config-item-value">Transacciones atómicas gestionadas por base de datos</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
