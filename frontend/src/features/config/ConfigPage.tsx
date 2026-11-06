import { CircleSlash, Database, Info, Server, Settings } from "lucide-react";
import CollapsibleBanner from "../../components/ui/CollapsibleBanner";
import { API_BASE_URL } from "../../lib/api";
import "./config.css";

interface Props {
  active: boolean;
  backendOnline: boolean;
}

export default function ConfigPage({ active, backendOnline }: Props) {
  return (
    <div className="config-page" hidden={!active}>
      <div className="section-heading">
        <h2>Configuración del sistema</h2>
        <span className="demo-label">Parámetros operativos · Sentinel v0.2.0</span>
      </div>

      <CollapsibleBanner
        id="config-environment-info"
        title="Parámetros del entorno de ejecución"
        tone="info"
        icon={<Info size={18} className="banner-main-icon" aria-hidden="true" />}
        ariaLabel="Aviso de configuración"
      >
        <p>
          Esta pantalla detalla la configuración técnica real del sistema. Las reglas de autorización para operaciones blockchain se configuran de forma completa en la pestaña <strong>Políticas</strong>. Sentinel no implementa ajustes ficticios ni opciones simuladas.
        </p>
      </CollapsibleBanner>

      <div className="config-grid">
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
              <span className="config-item-value numeric">v0.2.0 (/api/v1)</span>
            </li>
          </ul>
        </section>

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
              <span className="config-item-label">Control de concurrencia e idempotencia</span>
              <span className="config-item-value">
                Cabecera <code>Idempotency-Key</code> (UUIDv4) con persistencia de solicitud y respuesta
              </span>
            </li>
            <li>
              <span className="config-item-label">Reglas de autorización</span>
              <span className="config-item-value">Coincidencias exactas, sensibles a mayúsculas y minúsculas</span>
            </li>
          </ul>
        </section>

        <section className="card" aria-labelledby="services-config-heading">
          <div className="card-header-row">
            <h3 id="services-config-heading">
              <Settings size={18} aria-hidden="true" />
              Módulos del sistema
            </h3>
          </div>
          <ul className="config-item-list">
            <li>
              <span className="config-item-label">Motor de políticas y evaluación</span>
              <span className="config-status-badge active">Implementado y operativo</span>
            </li>
            <li>
              <span className="config-item-label">Historial paginado y filtros UTC</span>
              <span className="config-status-badge active">Implementado y operativo</span>
            </li>
            <li>
              <span className="config-item-label">Centro de alertas por rechazo</span>
              <span className="config-status-badge active">Implementado y operativo</span>
            </li>
            <li>
              <span className="config-item-label">Gestión de catálogo de políticas</span>
              <span className="config-status-badge active">Implementado y operativo</span>
            </li>
          </ul>
        </section>

        <section className="card" aria-labelledby="limitations-config-heading">
          <div className="card-header-row">
            <h3 id="limitations-config-heading">
              <CircleSlash size={18} aria-hidden="true" />
              Integraciones no disponibles
            </h3>
          </div>
          <ul className="config-item-list">
            <li>
              <span className="config-item-label">Análisis de riesgo por inteligencia artificial</span>
              <span className="config-status-badge inactive">No disponible en esta versión</span>
              <span className="ops-field-help">El backend devuelve risk_score=null y risk_analysis_status=unavailable.</span>
            </li>
            <li>
              <span className="config-item-label">Firma criptográfica automatizada</span>
              <span className="config-status-badge inactive">No implementada</span>
              <span className="ops-field-help">requires_signature=null. Sentinel no custodia claves privadas.</span>
            </li>
            <li>
              <span className="config-item-label">Verificación y ejecución on-chain</span>
              <span className="config-status-badge inactive">No realizada / No enviada</span>
              <span className="ops-field-help">verification_status=not_performed, execution_status=not_submitted.</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
