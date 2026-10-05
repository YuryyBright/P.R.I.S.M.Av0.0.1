// Public API of the documents feature. Import from "@/features/documents" only.
// The list lives as a panel inside a collection; a single document has its own page (documentsRoutes).
export { DocumentsPanel } from "./components/DocumentsPanel";
export { documentsRoutes } from "./routes";
export {
  DOCUMENT_PERMISSIONS,
  DOCUMENTS_ROUTES,
} from "./constants/documents.constants";
export type { DocumentItem, DocumentStatus } from "./types/document.types";
